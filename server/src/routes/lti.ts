import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';

export const ltiRouter = Router();

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

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

function mapLTIRoles(ltiRoles: string[]): string[] {
  const roleMap: Record<string, string> = {
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor': 'instructor',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner': 'learner',
    'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator': 'admin',
    'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper': 'content_developer',
  };

  const mappedRoles: string[] = [];
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

    // Find the platform configuration
    const platformResult = await db.query(
      'SELECT * FROM lti_platforms WHERE issuer_url = $1 AND is_active = true',
      [issuer]
    );

    if (platformResult.rows.length === 0) {
      res.status(403).json({ error: 'Platform not registered' });
      return;
    }

    const platform = platformResult.rows[0];

    // Generate state and nonce
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Build the authentication request URL
    const authParams = new URLSearchParams({
      scope: 'openid',
      response_type: 'id_token',
      client_id: platform.client_id,
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

    const authUrl = `${platform.auth_endpoint}?${authParams.toString()}`;

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

    // Parse the JWT to get claims
    const parsed = parseJWT(idToken);
    if (!parsed) {
      res.status(400).json({ error: 'Invalid JWT format' });
      return;
    }

    const { header, claims } = parsed;

    // Find the platform by issuer
    const platformResult = await db.query(
      'SELECT * FROM lti_platforms WHERE issuer_url = $1 AND is_active = true',
      [claims.iss]
    );

    if (platformResult.rows.length === 0) {
      res.status(403).json({ error: 'Platform not found' });
      return;
    }

    const platform = platformResult.rows[0];

    // Verify the JWT signature
    const publicKey = await getPublicKey(platform.jwks_url, header.kid);
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

    // Check audience
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(platform.client_id)) {
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

    // Check if we have an existing LTI session for this user
    const existingSessionResult = await db.query(
      'SELECT user_id FROM lti_sessions WHERE platform_id = $1 AND lti_user_id = $2',
      [platform.id, ltiUserId]
    );

    let userId: string;

    if (existingSessionResult.rows.length > 0) {
      // User already linked, update the session
      userId = existingSessionResult.rows[0].user_id;

      await db.query(
        `UPDATE lti_sessions SET
          lti_email = $1,
          lti_name = $2,
          context_id = $3,
          context_title = $4,
          resource_link_id = $5,
          roles = $6,
          last_launch_at = NOW()
        WHERE platform_id = $7 AND lti_user_id = $8`,
        [
          email, name, context?.id, context?.title,
          resourceLink?.id, mapLTIRoles(ltiRoles),
          platform.id, ltiUserId
        ]
      );
    } else {
      // New user - create user and link
      if (!email) {
        res.status(400).json({ error: 'Email is required for new users' });
        return;
      }

      // Check if a user with this email already exists
      const existingUserResult = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUserResult.rows.length > 0) {
        userId = existingUserResult.rows[0].id;
      } else {
        // Create new user
        const newUserResult = await db.query(
          `INSERT INTO users (email, full_name, email_verified)
           VALUES ($1, $2, true)
           RETURNING id`,
          [email, name]
        );
        userId = newUserResult.rows[0].id;

        // Assign default role
        await db.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [userId, 'learner']
        );
      }

      // Create LTI session link
      await db.query(
        `INSERT INTO lti_sessions 
          (user_id, platform_id, lti_user_id, lti_email, lti_name, 
           context_id, context_title, resource_link_id, roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, platform.id, ltiUserId, email, name,
          context?.id, context?.title, resourceLink?.id, mapLTIRoles(ltiRoles)
        ]
      );
    }

    // Generate tokens for the user
    const userResult = await db.query(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    const accessToken = generateToken({ id: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ id: user.id, email: user.email });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, expiresAt]
    );

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
