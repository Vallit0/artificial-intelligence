import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import prisma from '../db/index.js';
import { generateAccessToken, generateRefreshToken } from '../services/auth.service.js';
import { getPublicJwks } from '../services/toolKey.service.js';
import {
  isDeepLinkingRequest,
  extractDeepLinkingSettings,
  signDeepLinkingResponse,
  autoSubmitForm,
  SelectedScenarioItem,
} from '../services/deepLinking.service.js';
import config from '../config/index.js';
import { getLogger } from '../utils/logger.js';

export const ltiRouter = Router();

const APP_URL = config.appUrl;
const LAUNCH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEEP_LINKING_STATE_TTL_MS = 30 * 60 * 1000; // 30 min — teacher needs time to pick

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
    getLogger({ component: 'lti', op: 'fetch-jwks' }).error({ err: error }, 'Error fetching JWKS');
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
/**
 * @openapi
 * /lti/initiate:
 *   post:
 *     tags: [LTI]
 *     summary: OIDC Login Initiation (LTI 1.3, paso 1)
 *     security: []
 *     description: >-
 *       Lo invoca el LMS (Moodle) para iniciar el flujo OIDC. Valida que la
 *       plataforma esté registrada, persiste un `state`+`nonce` de un solo uso
 *       y redirige (302) al `authEndpoint` de la plataforma con los parámetros
 *       de autenticación. No usa bearer JWT propio.
 *     requestBody:
 *       required: true
 *       description: Campos enviados por el LMS (form_post o query).
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [iss, login_hint, target_link_uri]
 *             properties:
 *               iss: { type: string, description: Issuer URL de la plataforma }
 *               login_hint: { type: string }
 *               target_link_uri: { type: string, format: uri }
 *               lti_message_hint: { type: string }
 *     responses:
 *       302:
 *         description: Redirección al endpoint de autenticación de la plataforma.
 *         headers:
 *           Location:
 *             description: URL del authEndpoint con scope/response_type/client_id/state/nonce.
 *             schema: { type: string, format: uri }
 *       400: { description: Faltan parámetros requeridos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Plataforma no registrada o inactiva, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: Error interno, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
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
    const expiresAt = new Date(Date.now() + LAUNCH_STATE_TTL_MS);

    // Persist state + nonce so /launch can verify they match the values we
    // issued (CSRF + replay protection). Same call cleans expired rows
    // opportunistically — keeps the table from growing unbounded without a
    // dedicated cron job.
    await prisma.$transaction([
      prisma.ltiLaunchState.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
      prisma.ltiLaunchState.create({
        data: { state, nonce, platformId: platform.id, expiresAt },
      }),
    ]);

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
    getLogger({ component: 'lti', op: 'initiate' }).error({ err: error }, 'LTI initiate error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /lti/launch - LTI Launch (receives id_token)
// ============================================
/**
 * @openapi
 * /lti/launch:
 *   post:
 *     tags: [LTI]
 *     summary: LTI Launch (LTI 1.3, paso 2 — recibe el id_token firmado)
 *     security: []
 *     description: >-
 *       Endpoint `target_link_uri` al que el LMS hace form_post con el
 *       `id_token` y el `state` emitido en `/lti/initiate`. Verifica firma
 *       (JWKS de la plataforma), `state`/`nonce`, `exp` y `aud`, y luego
 *       ramifica según `message_type`:
 *       (a) `LtiDeepLinkingRequest` → crea un estado de deep linking y redirige
 *       (302) a la página del picker (`/lti/deep-linking/select?state=...`);
 *       (b) `LtiResourceLinkRequest` → hace JIT-provisioning del usuario, emite
 *       access/refresh tokens propios y redirige (302) a la SPA con los tokens
 *       en query (`access_token`, `refresh_token`, opcional `scenario`).
 *       No usa bearer JWT propio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [id_token, state]
 *             properties:
 *               id_token: { type: string, description: JWT firmado por la plataforma (LTI 1.3). }
 *               state: { type: string, description: Valor emitido en /lti/initiate (un solo uso). }
 *     responses:
 *       302:
 *         description: >-
 *           Redirección a la SPA. En launch de recurso, a la app con
 *           `access_token`/`refresh_token` (y opcional `scenario`) en query;
 *           en deep linking, al picker con `state` en query.
 *         headers:
 *           Location:
 *             schema: { type: string, format: uri }
 *       400: { description: id_token/state ausente, JWT mal formado, settings de deep linking inválidos, o email requerido para usuario nuevo, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: State desconocido/expirado/de otra plataforma, nonce mismatch, firma o audience inválida, o token expirado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: Plataforma no encontrada o inactiva, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: No se pudo obtener la clave pública o error interno, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       503: { description: No hay sede configurada para el JIT-provisioning, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
ltiRouter.post('/launch', async (req: Request, res: Response) => {
  try {
    const idToken = req.body.id_token;
    const stateParam = req.body.state;

    if (!idToken) {
      res.status(400).json({ error: 'Missing id_token' });
      return;
    }
    if (!stateParam) {
      res.status(400).json({ error: 'Missing state' });
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

    // Validate state was issued by /lti/initiate, hasn't expired, belongs
    // to this same platform, and the nonce in the id_token matches the one
    // we paired with that state. Delete on read so it can't be replayed.
    const launchState = await prisma.ltiLaunchState.findUnique({
      where: { state: stateParam },
    });
    if (!launchState) {
      res.status(401).json({ error: 'Unknown or already-used state' });
      return;
    }
    await prisma.ltiLaunchState.delete({ where: { state: stateParam } });
    if (launchState.expiresAt < new Date()) {
      res.status(401).json({ error: 'State expired' });
      return;
    }
    if (launchState.platformId !== platform.id) {
      res.status(401).json({ error: 'State does not match issuer' });
      return;
    }
    if (claims.nonce !== launchState.nonce) {
      res.status(401).json({ error: 'Nonce mismatch' });
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

    // Branch on message_type. LtiDeepLinkingRequest is the teacher-side flow
    // where Moodle is asking us to render a content picker; we persist a
    // short-lived state row and redirect to the picker UI instead of running
    // the resource-link launch path.
    if (isDeepLinkingRequest(claims)) {
      const settings = extractDeepLinkingSettings(claims);
      if (!settings) {
        res.status(400).json({ error: 'Deep linking settings missing or malformed' });
        return;
      }

      const deploymentId = claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'];
      if (typeof deploymentId !== 'string') {
        res.status(400).json({ error: 'deployment_id claim missing' });
        return;
      }

      if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
        res.status(400).json({ error: 'sub claim missing in deep linking request' });
        return;
      }

      const ctx = claims['https://purl.imsglobal.org/spec/lti/claim/context'];

      const dlState = await prisma.ltiDeepLinkingState.create({
        data: {
          platformId: platform.id,
          deploymentId,
          returnUrl: settings.deep_link_return_url,
          data: settings.data ?? null,
          ltiUserId: claims.sub,
          contextId: ctx?.id ?? null,
          contextTitle: ctx?.title ?? null,
          expiresAt: new Date(Date.now() + DEEP_LINKING_STATE_TTL_MS),
        },
      });

      // Redirect to the SPA picker page. The state id is the only credential
      // — short-lived (30 min) and single-use, so it's acceptable as a
      // bearer for the picker flow.
      const pickerUrl = new URL(APP_URL);
      pickerUrl.pathname = '/lti/deep-linking/select';
      pickerUrl.searchParams.set('state', dlState.id);
      res.redirect(302, pickerUrl.toString());
      return;
    }

    // Extract user info
    const ltiUserId = claims.sub;
    const email = claims.email;
    const name = claims.name || `${claims.given_name || ''} ${claims.family_name || ''}`.trim();
    const context = claims['https://purl.imsglobal.org/spec/lti/claim/context'];
    const resourceLink = claims['https://purl.imsglobal.org/spec/lti/claim/resource_link'];
    const ltiRoles = claims['https://purl.imsglobal.org/spec/lti/claim/roles'] || [];

    // AGS endpoint claim — present only when the teacher attached the tool
    // to a gradable activity. Captured per session so submitScore() can
    // post back without depending on global config.
    const agsEndpoint = claims['https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'];
    const agsLineitemUrl = agsEndpoint?.lineitem ?? null;
    const agsLineitemsUrl = agsEndpoint?.lineitems ?? null;
    const agsScopes: string[] = Array.isArray(agsEndpoint?.scope) ? agsEndpoint.scope : [];

    // NRPS endpoint claim — present when Moodle has the Names & Role
    // Provisioning service enabled on the tool. Captured here so a single
    // launch from any teacher is enough to opt the course into periodic
    // roster sync (we upsert LtiCourseSync below).
    const nrpsClaim = claims['https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice'];
    const nrpsMembershipsUrl: string | null = nrpsClaim?.context_memberships_url ?? null;

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
          agsLineitemUrl,
          agsLineitemsUrl,
          agsScopes,
          nrpsMembershipsUrl,
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
        // Resolver sede al hacer JIT-provisioning desde el launch.
        // Preferimos la sede registrada en LtiCourseSync (admin la asignó
        // explícitamente al curso); fallback: primera sede activa.
        let sedeIdForNewUser: string | null = null;
        if (context?.id) {
          const cs = await prisma.ltiCourseSync.findUnique({
            where: { platformId_contextId: { platformId: platform.id, contextId: context.id } },
            select: { defaultSedeId: true },
          });
          if (cs?.defaultSedeId) {
            const sede = await prisma.sede.findFirst({
              where: { id: cs.defaultSedeId, isActive: true },
              select: { id: true },
            });
            sedeIdForNewUser = sede?.id ?? null;
          }
        }
        if (!sedeIdForNewUser) {
          const fallback = await prisma.sede.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });
          sedeIdForNewUser = fallback?.id ?? null;
        }
        if (!sedeIdForNewUser) {
          res.status(503).json({ error: 'No hay sede configurada — contactá al administrador' });
          return;
        }

        user = await prisma.user.create({
          data: {
            email,
            firstName: name?.split(' ')[0] || null,
            lastName: name?.split(' ').slice(1).join(' ') || null,
            emailVerified: true,
            sedeId: sedeIdForNewUser,
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
          agsLineitemUrl,
          agsLineitemsUrl,
          agsScopes,
          nrpsMembershipsUrl,
        },
      });
    }

    // Auto-register the course for periodic roster sync. We only need one
    // launch from any user (teacher or student) to learn the NRPS endpoint
    // and the default lineitem; from there the cron can pre-create
    // LtiSessions for everyone else so their web-only practice still
    // posts grades. Upsert so re-launches refresh the lineitemUrl if the
    // teacher re-binds the activity, but keep isActive untouched so admin
    // toggles aren't reverted by traffic.
    if (nrpsMembershipsUrl && context?.id) {
      await prisma.ltiCourseSync.upsert({
        where: {
          platformId_contextId: { platformId: platform.id, contextId: context.id },
        },
        create: {
          platformId: platform.id,
          contextId: context.id,
          contextTitle: context.title ?? null,
          membershipsUrl: nrpsMembershipsUrl,
          lineitemUrl: agsLineitemUrl,
        },
        update: {
          contextTitle: context.title ?? undefined,
          membershipsUrl: nrpsMembershipsUrl,
          ...(agsLineitemUrl ? { lineitemUrl: agsLineitemUrl } : {}),
        },
      });
    }

    // Generate tokens
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: { select: { role: true } } },
    });

    const authUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      sedeId: user.sedeId,
      roles: user.roles.map((r) => r.role) as any,
    };
    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(authUser);

    // Store refresh token
    const expiresAt = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: { userId, token: refreshToken, expiresAt },
    });

    // Redirect to app with tokens. If the resource link was deep-linked
    // with a specific scenarioId in custom params, route directly to the
    // practice page for that scenario; otherwise land on the menu.
    const customClaim = claims['https://purl.imsglobal.org/spec/lti/claim/custom'];
    const customScenarioId =
      customClaim && typeof customClaim === 'object' && typeof customClaim.scenarioId === 'string'
        ? customClaim.scenarioId
        : null;

    const redirectUrl = new URL(APP_URL);
    if (customScenarioId) {
      redirectUrl.pathname = '/practice';
      redirectUrl.searchParams.set('scenario', customScenarioId);
    }
    redirectUrl.searchParams.set('access_token', accessToken);
    redirectUrl.searchParams.set('refresh_token', refreshToken);

    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    getLogger({ component: 'lti', op: 'launch' }).error({ err: error }, 'LTI launch error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// GET /lti/info - Platform Registration Info
// ============================================
/**
 * @openapi
 * /lti/info:
 *   get:
 *     tags: [LTI]
 *     summary: Datos de registro de la herramienta (para configurar en el LMS)
 *     security: []
 *     description: >-
 *       Devuelve metadatos estáticos del tool LTI 1.3 (URLs de initiate/launch,
 *       JWKS, redirect_uris, mensajes soportados) para registrarlo manualmente
 *       en Moodle. No usa bearer JWT propio.
 *     responses:
 *       200:
 *         description: Información de registro del tool.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tool_name: { type: string }
 *                 description: { type: string }
 *                 lti_version: { type: string, example: '1.3.0' }
 *                 initiate_login_url: { type: string, format: uri }
 *                 target_link_uri: { type: string, format: uri }
 *                 redirect_uris: { type: array, items: { type: string, format: uri } }
 *                 oidc_initiation_url: { type: string, format: uri }
 *                 public_jwks_url: { type: string, format: uri }
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type: { type: string, example: LtiResourceLinkRequest }
 *                       target_link_uri: { type: string, format: uri }
 */
ltiRouter.get('/info', (req: Request, res: Response) => {
  res.json({
    tool_name: 'Corporación Señoriales - Práctica de Ventas',
    description: 'Herramienta de práctica de ventas con IA conversacional',
    lti_version: '1.3.0',
    initiate_login_url: `${APP_URL}/lti/initiate`,
    target_link_uri: `${APP_URL}/lti/launch`,
    redirect_uris: [`${APP_URL}/lti/launch`],
    oidc_initiation_url: `${APP_URL}/lti/initiate`,
    public_jwks_url: `${APP_URL}/lti/jwks`,
    messages: [
      {
        type: 'LtiResourceLinkRequest',
        target_link_uri: `${APP_URL}/lti/launch`,
      },
    ],
  });
});

// ============================================
// GET /lti/jwks - Public JWKS for the tool
// ============================================
// Moodle (and other platforms) fetch this when verifying client_assertion
// JWTs we send to their token endpoint, and Deep Linking responses we
// post back. Cache for 10 minutes — long enough to avoid hammering on
// every token call, short enough that key rotation propagates quickly.
/**
 * @openapi
 * /lti/jwks:
 *   get:
 *     tags: [LTI]
 *     summary: JWKS público del tool (claves RSA de firma)
 *     security: []
 *     description: >-
 *       Set de claves públicas (JWKS) que el LMS consulta para verificar los
 *       `client_assertion` JWT y las respuestas de Deep Linking firmadas por
 *       el tool. Durante una rotación puede devolver más de una clave activa.
 *       Responde con `Cache-Control: public, max-age=600`. No usa bearer JWT propio.
 *     responses:
 *       200:
 *         description: Conjunto de claves públicas en formato JWKS.
 *         headers:
 *           Cache-Control:
 *             schema: { type: string, example: 'public, max-age=600' }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       kty: { type: string, example: RSA }
 *                       use: { type: string, example: sig }
 *                       alg: { type: string, example: RS256 }
 *                       kid: { type: string }
 *                       n: { type: string, description: Módulo RSA (base64url) }
 *                       e: { type: string, description: Exponente público (base64url) }
 *       500: { description: No se pudo construir el JWKS, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
ltiRouter.get('/jwks', async (_req: Request, res: Response) => {
  try {
    const jwks = await getPublicJwks();
    res.set('Cache-Control', 'public, max-age=600');
    res.json(jwks);
  } catch (error) {
    getLogger({ component: 'lti', op: 'jwks' }).error({ err: error }, 'Failed to build JWKS');
    res.status(500).json({ error: 'Could not build JWKS' });
  }
});

// ============================================
// Deep Linking picker endpoints
// ============================================
// These two are consumed by the SPA picker rendered at /lti/deep-linking/select.
// Auth model: the `state` id is generated server-side at launch, short-lived
// (30 min), and single-use. Possession of it stands in for a session here —
// the teacher arrived from Moodle and likely has no Señoriales account yet.

// GET state + scenario list so the picker can render the form.
/**
 * @openapi
 * /lti/deep-linking/state/{id}:
 *   get:
 *     tags: [LTI]
 *     summary: Bootstrap del picker de Deep Linking (estado + escenarios)
 *     security: []
 *     description: >-
 *       Lo consume la SPA del picker (`/lti/deep-linking/select`) para renderizar
 *       el formulario. La posesión del `id` (generado en el launch, de un solo
 *       uso, expira a los 30 min) funciona como credencial; no usa bearer JWT propio.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Id del estado de Deep Linking emitido en /lti/launch.
 *     responses:
 *       200:
 *         description: Estado válido + lista de escenarios activos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stateId: { type: string, format: uuid }
 *                 platformName: { type: string }
 *                 contextTitle: { type: string, nullable: true }
 *                 scenarios:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       name: { type: string }
 *                       description: { type: string, nullable: true }
 *                       displayOrder: { type: integer }
 *       404: { description: Estado de Deep Linking no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       410: { description: Estado ya usado o expirado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: Error interno, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
ltiRouter.get('/deep-linking/state/:id', async (req: Request, res: Response) => {
  try {
    const state = await prisma.ltiDeepLinkingState.findUnique({
      where: { id: req.params.id },
      include: { platform: { select: { name: true } } },
    });
    if (!state) {
      res.status(404).json({ error: 'Deep linking state not found' });
      return;
    }
    if (state.consumedAt) {
      res.status(410).json({ error: 'Deep linking state already used' });
      return;
    }
    if (state.expiresAt < new Date()) {
      res.status(410).json({ error: 'Deep linking state expired' });
      return;
    }

    const scenarios = await prisma.scenario.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, displayOrder: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      stateId: state.id,
      platformName: state.platform.name,
      contextTitle: state.contextTitle,
      scenarios,
    });
  } catch (error) {
    getLogger({ component: 'lti', op: 'dl-state' }).error({ err: error }, 'Failed to fetch deep linking state');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Picker submits selection. We sign a LtiDeepLinkingResponse JWT, mark the
// state consumed, and return an HTML auto-submit form. Returning text/html
// directly (instead of JSON) keeps the browser flow seamless — the picker
// page replaces document.body with this HTML and the form submits to
// Moodle automatically.
const submitSchema = z.object({
  stateId: z.string().uuid(),
  // scenarioIds can be empty — that means "show the practice menu". Each
  // ltiResourceLink rendered in Moodle becomes one clickable activity.
  scenarioIds: z.array(z.string().uuid()).optional().default([]),
  includeMenuLink: z.boolean().optional().default(false),
});

/**
 * @openapi
 * /lti/deep-linking/submit:
 *   post:
 *     tags: [LTI]
 *     summary: Envía la selección del picker y devuelve el form de auto-submit a Moodle
 *     security: []
 *     description: >-
 *       Lo invoca la SPA del picker con los escenarios elegidos. Firma un
 *       `LtiDeepLinkingResponse` JWT, marca el estado como consumido y devuelve
 *       una página `text/html` con un formulario de auto-submit que el navegador
 *       postea a `deep_link_return_url` de la plataforma. Si no se elige nada (o
 *       `includeMenuLink`), agrega un link al menú de práctica. No usa bearer JWT propio.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stateId]
 *             properties:
 *               stateId: { type: string, format: uuid }
 *               scenarioIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Vacío significa "mostrar el menú completo".
 *               includeMenuLink: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: >-
 *           HTML con formulario de auto-submit (JWT `LtiDeepLinkingResponse`)
 *           que el navegador postea de vuelta a la plataforma.
 *         content:
 *           text/html:
 *             schema: { type: string }
 *       400: { description: Body inválido (Zod) — incluye `issues`, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Estado de Deep Linking no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       410: { description: Estado ya usado o expirado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       500: { description: Error interno, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
ltiRouter.post('/deep-linking/submit', async (req: Request, res: Response) => {
  try {
    const parsed = submitSchema.parse(req.body);

    const state = await prisma.ltiDeepLinkingState.findUnique({
      where: { id: parsed.stateId },
      include: { platform: true },
    });
    if (!state) {
      res.status(404).json({ error: 'Deep linking state not found' });
      return;
    }
    if (state.consumedAt) {
      res.status(410).json({ error: 'Deep linking state already used' });
      return;
    }
    if (state.expiresAt < new Date()) {
      res.status(410).json({ error: 'Deep linking state expired' });
      return;
    }

    // Resolve scenarios. Skip any IDs that no longer exist or are inactive
    // (teacher may have left the picker open for a while).
    const scenarios = parsed.scenarioIds.length
      ? await prisma.scenario.findMany({
          where: { id: { in: parsed.scenarioIds }, isActive: true },
          select: { id: true, name: true, description: true },
        })
      : [];

    const launchUrl = `${APP_URL}/lti/launch`;

    const items: SelectedScenarioItem[] = scenarios.map((s) => ({
      scenarioId: s.id,
      title: s.name,
      description: s.description ?? undefined,
      launchUrl,
    }));

    if (parsed.includeMenuLink || items.length === 0) {
      // Always provide at least one link so Moodle has something to embed —
      // if the teacher picked nothing, fall back to the practice menu so the
      // activity isn't empty.
      items.push({
        scenarioId: null,
        title: 'Práctica Señoriales',
        description: 'Menú completo de prácticas y escenarios',
        launchUrl,
      });
    }

    const jwtToken = await signDeepLinkingResponse({
      platformClientId: state.platform.clientId,
      platformIssuerUrl: state.platform.issuerUrl,
      deploymentId: state.deploymentId,
      data: state.data,
      items,
    });

    await prisma.ltiDeepLinkingState.update({
      where: { id: state.id },
      data: { consumedAt: new Date() },
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(autoSubmitForm(state.returnUrl, jwtToken));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', issues: error.issues });
      return;
    }
    getLogger({ component: 'lti', op: 'dl-submit' }).error({ err: error }, 'Failed to submit deep linking response');
    res.status(500).json({ error: 'Internal server error' });
  }
});
