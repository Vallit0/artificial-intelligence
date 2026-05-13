// LTI 1.3 Deep Linking 2.0 — handles the side of the handshake where Moodle
// (the platform) asks our tool to let an instructor select content to embed
// in their course. The launch arrives as a regular LTI launch but with
// message_type = LtiDeepLinkingRequest and a `deep_linking_settings` claim
// carrying the return URL. We persist the relevant state, render a picker,
// and on submit sign a LtiDeepLinkingResponse JWT that the picker form
// auto-submits back to the return URL.

import jwt from 'jsonwebtoken';
import { getActiveSigningKey } from './toolKey.service.js';

const MESSAGE_TYPE_REQUEST = 'LtiDeepLinkingRequest';
const MESSAGE_TYPE_RESPONSE = 'LtiDeepLinkingResponse';
const CLAIM_MESSAGE_TYPE = 'https://purl.imsglobal.org/spec/lti/claim/message_type';
const CLAIM_VERSION = 'https://purl.imsglobal.org/spec/lti/claim/version';
const CLAIM_DEPLOYMENT_ID = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id';
const CLAIM_DEEP_LINKING_SETTINGS = 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings';
const CLAIM_CONTENT_ITEMS = 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items';
const CLAIM_DATA = 'https://purl.imsglobal.org/spec/lti-dl/claim/data';

const RESPONSE_TTL_SECONDS = 300;

export function isDeepLinkingRequest(claims: Record<string, unknown>): boolean {
  return claims[CLAIM_MESSAGE_TYPE] === MESSAGE_TYPE_REQUEST;
}

export interface DeepLinkingSettings {
  deep_link_return_url: string;
  accept_types?: string[];
  accept_presentation_document_targets?: string[];
  accept_multiple?: boolean;
  data?: string;
  title?: string;
  text?: string;
}

export function extractDeepLinkingSettings(claims: Record<string, unknown>): DeepLinkingSettings | null {
  const raw = claims[CLAIM_DEEP_LINKING_SETTINGS];
  if (!raw || typeof raw !== 'object') return null;
  const settings = raw as DeepLinkingSettings;
  if (typeof settings.deep_link_return_url !== 'string') return null;
  return settings;
}

export interface SelectedScenarioItem {
  scenarioId: string | null; // null means "open practice menu" (no specific scenario)
  title: string;
  description?: string;
  launchUrl: string;
}

// Build the LtiResourceLink content_items[] entries. Each entry tells Moodle:
//   - the link is a resource link to launch our tool with these params
//   - the custom params let us route to the specific scenario at launch time
function buildContentItems(items: SelectedScenarioItem[]): Array<Record<string, unknown>> {
  return items.map((item) => ({
    type: 'ltiResourceLink',
    title: item.title,
    text: item.description,
    url: item.launchUrl,
    custom: item.scenarioId
      ? { scenarioId: item.scenarioId }
      : {},
  }));
}

export async function signDeepLinkingResponse(params: {
  platformClientId: string;
  platformIssuerUrl: string;
  deploymentId: string;
  data: string | null;
  items: SelectedScenarioItem[];
}): Promise<string> {
  const { kid, algorithm, privateKey } = await getActiveSigningKey();
  const now = Math.floor(Date.now() / 1000);

  // Per LTI 1.3 the response is sent as id_token JWT where:
  //   iss = our tool's client_id assigned by the platform
  //   aud = the platform's issuer URL
  //   sub = same as iss (no end-user subject in a tool→platform message)
  const payload: Record<string, unknown> = {
    iss: params.platformClientId,
    aud: params.platformIssuerUrl,
    sub: params.platformClientId,
    iat: now,
    exp: now + RESPONSE_TTL_SECONDS,
    nonce: cryptoRandomNonce(),
    [CLAIM_MESSAGE_TYPE]: MESSAGE_TYPE_RESPONSE,
    [CLAIM_VERSION]: '1.3.0',
    [CLAIM_DEPLOYMENT_ID]: params.deploymentId,
    [CLAIM_CONTENT_ITEMS]: buildContentItems(params.items),
  };

  if (params.data) {
    payload[CLAIM_DATA] = params.data;
  }

  return jwt.sign(payload, privateKey, {
    algorithm: algorithm as jwt.Algorithm,
    keyid: kid,
  });
}

function cryptoRandomNonce(): string {
  // 128-bit random hex — overkill for nonce but cheap.
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// HTML form that auto-submits a signed JWT back to the platform's
// deep_link_return_url. Per spec, the platform expects a POST with
// JWT={signed_token}. The form is self-submitting via inline JS; we keep
// the page minimal so it doesn't flash to the teacher.
export function autoSubmitForm(returnUrl: string, jwtToken: string): string {
  // returnUrl comes from the signed launch JWT we already verified, so it's
  // trusted. Still HTML-escape to be defensive.
  const safeUrl = escapeHtml(returnUrl);
  const safeJwt = escapeHtml(jwtToken);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Enviando selección a Moodle…</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#475569}</style>
</head>
<body>
<form id="dl-form" action="${safeUrl}" method="POST">
<input type="hidden" name="JWT" value="${safeJwt}">
<noscript><button type="submit">Continuar a Moodle</button></noscript>
</form>
<p>Enviando selección a Moodle…</p>
<script>document.getElementById('dl-form').submit();</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const DEEP_LINKING_CLAIMS = {
  MESSAGE_TYPE: CLAIM_MESSAGE_TYPE,
  DEEP_LINKING_SETTINGS: CLAIM_DEEP_LINKING_SETTINGS,
  DATA: CLAIM_DATA,
} as const;
