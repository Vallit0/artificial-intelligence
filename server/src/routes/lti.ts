import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/index.js';
import { generateAccessToken, generateRefreshToken } from '../services/auth.service.js';
import config from '../config/index.js';

export const ltiRouter = Router();

const APP_URL = config.appUrl;

// ============================================
// Utility functions
// ============================================

function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binaryString = Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function getPublicKey(jwksUrl: string, kid: string): Promise<crypto.KeyObject | null> {
  try {
    const response = await fetch(jwksUrl);
    const jwks = await response.json();

    const key = jwks.keys?.find((k: { kid: string }) => k.kid === kid);
    if (!key) return null;

    return crypto.createPublicKey({ key, format: 'jwk' });
  } catch (error) {
    console.error('Error fetching JWKS:', error);
    return null;
  }
}

async function verifyJWT(token: string, publicKey: crypto.KeyObject): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(base64UrlDecode(parts[2]));

  return crypto.verify(
    'sha256',
    Buffer.from(signatureInput),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    signature
  );
}

function parseJWT(token: string): { header: any; claims: any } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(base64UrlDecode(parts[0])).toString());
    const claims = JSON.parse(Buffer.from(base64UrlDecode(parts[1])).toString());

    return { header, claims };
  } catch {
    return null;
  }
}

type LtiRoleValue = 'instructor' | 'learner' | 'admin' | 'content_developer';

function mapLTIRoles(ltiRoles: string[]): LtiRoleValue[] {
  const roleMap: Record<string, LtiRoleValue> = {
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor': 'instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner': 'learner',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator': 'admin',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper': 'content_developer',
  };

  const mappedRoles: LtiRoleValue[] = [];
  for (const role of ltiRoles) {
    if (roleMap[role]) {
      mappedRoles.push(roleMap[role]);
    }
  }

  return mappedRoles.length > 0 ? mappedRoles : ['learner'];
}

// ============================================
// POST /lti/initiate - OIDC Login Initiation
// ============================================
ltiRouter.post('/initiate', async (req: Request, res: Response) => {
  try {
    const issuer = req.body.iss;
    const loginHint = req.body.login_hint;
    const targetLinkUri = req.body.target_link_uri;
    const ltiMessageHint = req.body.lti_message_hint;

    if (!issuer || !loginHint || !targetLinkUri) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    const platform = await prisma.ltiPlatform.findFirst({
      where: { issuerUrl: issuer, isActive: true },
    });

    if (!platform) {
      res.status(403).json({ error: 'Platform not registered' });
      return;
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    const authParams = new URLSearchParams({
      scope: 'openid',
      response_type: 'id_token',
      client_id: platform.clientId,
      redirect_uri: `${APP_URL}/lti/launch`,
      login_hint: loginHint,
      state: state,
      response_mode: 'form_post',
      nonce: nonce,
      prompt: 'none',
    });

    if (ltiMessageHint) {
      authParams.set('lti_message_hint', ltiMessageHint);
    }

    const authUrl = `${platform.authEndpoint}?${authParams.toString()}`;
    res.redirect(302, authUrl);
  } catch (error) {
    console.error('LTI initiate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /lti/launch - LTI Launch (receives id_token)
// ============================================
ltiRouter.post('/launch', async (req: Request, res: Response) => {
  try {
    const idToken = req.body.id_token;

    if (!idToken) {
      res.status(400).json({ error: 'Missing id_token' });
      return;
    }

    const parsed = parseJWT(idToken);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid JWT format' });
      return;
    }

    const { header, claims } = parsed;

    const platform = await prisma.ltiPlatform.findFirst({
      where: { issuerUrl: claims.iss, isActive: true },
    });

    if (!platform) {
      res.status(403).json({ error: 'Platform not found' });
      return;
    }

    // Verify JWT signature
    const publicKey = await getPublicKey(platform.jwksUrl, header.kid);
    if (!publicKey) {
      res.status(500).json({ error: 'Could not fetch public key' });
      return;
    }

    const isValid = await verifyJWT(idToken, publicKey);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid JWT signature' });
      return;
    }

    // Validate claims
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(platform.clientId)) {
      res.status(401).json({ error: 'Invalid audience' });
      return;
    }

    // Extract user info
    const ltiUserId = claims.sub;
    const email = claims.email;
    const name = claims.name || `${claims.given_name || ''} ${claims.family_name || ''}`.trim();
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
    const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
    const ltiRoles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];

    // Check for existing LTI session
    const existingSession = await prisma.ltiSession.findUnique({
      where: { platformId_ltiUserId: { platformId: platform.id, ltiUserId } },
    });

    let userId: string;

    if (existingSession) {
      userId = existingSession.userId;

      await prisma.ltiSession.update({
        where: { id: existingSession.id },
        data: {
          ltiEmail: email,
          ltiName: name,
          contextId: context?.id,
          contextTitle: context?.title,
          resourceLinkId: resourceLink?.id,
          roles: mapLTIRoles(ltiRoles),
          lastLaunchAt: new Date(),
        },
      });
    } else {
      if (!email) {
        res.status(400).json({ error: 'Email is required for new users' });
        return;
      }

      // Find or create user
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            firstName: name?.split(' ')[0] || null,
            lastName: name?.split(' ').slice(1).join(' ') || null,
            emailVerified: true,
            roles: { create: { role: 'learner' } },
          },
        });
      }

      userId = user.id;

      // Create LTI session link
      await prisma.ltiSession.create({
        data: {
          userId,
          platformId: platform.id,
          ltiUserId,
          ltiEmail: email,
          ltiName: name,
          contextId: context?.id,
          contextTitle: context?.title,
          resourceLinkId: resourceLink?.id,
          roles: mapLTIRoles(ltiRoles),
        },
      });
    }

    // Generate tokens
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const authUser = { id: user.id, email: user.email, firstName: user.firstName || undefined, lastName: user.lastName || undefined };
    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(authUser);

    // Store refresh token
    const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    // Redirect to app with tokens
    const redirectUrl = new URL(APP_URL);
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error('LTI launch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET /lti/info - Platform Registration Info
// ============================================
ltiRouter.get('/info', (req: Request, res: Response) => {
  res.json({
    tool_name: 'Corporación Señoriales - Práctica de Ventas',
    description: 'Herramienta de práctica de ventas con IA conversacional',
    lti_version: '1.3.0',
    initiate_login_url: `${APP_URL}/lti/initiate`,
    target_link_uri: `${APP_URL}/lti/launch`,
    redirect_uris: [`${APP_URL}/lti/launch`],
    oidc_initiation_url: `${APP_URL}/lti/initiate`,
    public_jwks_url: null,
    messages: [
      {
        type: 'LtiResourceLinkRequest',
        target_link_uri: `${APP_URL}/lti/launch`,
      },
    ],
  });
});
