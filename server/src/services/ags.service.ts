// LTI AGS (Assignment & Grade Services) — push session scores back to the
// platform's gradebook. Triggered after an evaluation is persisted; safe
// to call on every session because we skip when the user did not arrive
// via LTI or the activity is not gradable.
//
// Flow per IMS LTI 1.3 / AGS 2.0:
//   1) Resolve which lineitem to score against (claim from launch, or
//      create one inside the lineitems collection if the resource is
//      gradable but has no fixed lineitem yet).
//   2) Get an access token via client_credentials grant scoped to AGS.
//   3) POST {lineitem}/scores with vnd.ims.lis.v1.score+json.

import prisma from '../db/index.js';
import { getPlatformAccessToken } from './lti.service.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger({ component: 'ags' });

const SCOPE_SCORE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
const SCOPE_LINEITEM = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';
const SCOPE_LINEITEM_RO = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly';

const CONTENT_TYPE_SCORE = 'application/vnd.ims.lis.v1.score+json';
const CONTENT_TYPE_LINEITEM = 'application/vnd.ims.lis.v2.lineitem+json';

const DEFAULT_LINEITEM_LABEL = 'Práctica Señoriales';

// Cuando hay que auto-crear el lineitem (el launch no trajo uno fijo), el
// label/tag dependen de qué examen produjo la nota, así el examen final y el
// de objeciones quedan en columnas separadas del gradebook.
const EXAM_LINEITEM: Record<'prospeccion' | 'objeciones', { label: string; tag: string }> = {
  prospeccion: { label: 'Examen Prospección Señoriales', tag: 'senoriales-examen-prospeccion' },
  objeciones: { label: 'Examen Objeciones Señoriales', tag: 'senoriales-examen-objeciones' },
};

export type GradingProgress = 'FullyGraded' | 'Pending' | 'PendingManual' | 'Failed' | 'NotReady';
export type ActivityProgress = 'Initialized' | 'Started' | 'InProgress' | 'Submitted' | 'Completed';

export interface SubmitScoreParams {
  userId: string;
  score: number;          // 0..scoreMaximum (defaults to 100)
  scoreMaximum?: number;
  feedback?: string;
  gradingProgress: GradingProgress;
  activityProgress?: ActivityProgress;
  examType?: 'prospeccion' | 'objeciones' | null;
}

export type SubmitScoreOutcome =
  | { status: 'submitted'; lineitemUrl: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

// Append `/scores` to a lineitem URL while preserving query string.
function buildScoresUrl(lineitemUrl: string): string {
  const url = new URL(lineitemUrl);
  url.pathname = url.pathname.replace(/\/+$/, '') + '/scores';
  return url.toString();
}

async function ensureLineitem(
  platformId: string,
  lineitemsUrl: string,
  scopes: string[],
  resourceLinkId: string | null,
  scoreMaximum: number,
  label: string,
  tag: string,
): Promise<string> {
  const canCreate = scopes.includes(SCOPE_LINEITEM);
  if (!canCreate) {
    throw new Error(
      `Cannot create lineitem: platform did not grant ${SCOPE_LINEITEM} scope`,
    );
  }

  const token = await getPlatformAccessToken(platformId, [SCOPE_LINEITEM]);
  const body = {
    scoreMaximum,
    label,
    ...(resourceLinkId ? { resourceLinkId } : {}),
    tag,
  };

  const res = await fetch(lineitemsUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': CONTENT_TYPE_LINEITEM,
      Accept: CONTENT_TYPE_LINEITEM,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Failed to create lineitem: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }

  const created = (await res.json()) as { id?: string };
  if (!created.id) {
    throw new Error('Lineitem creation returned no id');
  }
  return created.id;
}

export async function submitScoreForUser(params: SubmitScoreParams): Promise<SubmitScoreOutcome> {
  const scoreMaximum = params.scoreMaximum ?? 100;

  // Pick the most recent LTI session for the user. If they practice from
  // the web after a launch from Moodle, the score still posts to the most
  // recent gradable context they came from.
  const ltiSession = await prisma.ltiSession.findFirst({
    where: { userId: params.userId },
    orderBy: { lastLaunchAt: 'desc' },
  });

  if (!ltiSession) {
    return { status: 'skipped', reason: 'user has no LTI session' };
  }
  if (!ltiSession.agsLineitemUrl && !ltiSession.agsLineitemsUrl) {
    return { status: 'skipped', reason: 'launch did not include AGS endpoint' };
  }
  if (!ltiSession.agsScopes.includes(SCOPE_SCORE)) {
    return { status: 'skipped', reason: 'platform did not grant score scope' };
  }

  const lineitemMeta = params.examType
    ? EXAM_LINEITEM[params.examType]
    : { label: DEFAULT_LINEITEM_LABEL, tag: 'senoriales-practice' };

  let lineitemUrl = ltiSession.agsLineitemUrl;
  if (!lineitemUrl) {
    try {
      lineitemUrl = await ensureLineitem(
        ltiSession.platformId,
        ltiSession.agsLineitemsUrl!,
        ltiSession.agsScopes,
        ltiSession.resourceLinkId,
        scoreMaximum,
        lineitemMeta.label,
        lineitemMeta.tag,
      );
      // Cache the resolved lineitem so subsequent submissions skip the
      // create round-trip even if the platform did not return one in the
      // launch claim.
      await prisma.ltiSession.update({
        where: { id: ltiSession.id },
        data: { agsLineitemUrl: lineitemUrl },
      });
    } catch (err) {
      log.error({ err, userId: params.userId }, 'AGS lineitem resolution failed');
      return { status: 'failed', reason: 'lineitem resolution failed' };
    }
  }

  const scoresUrl = buildScoresUrl(lineitemUrl);

  let token: string;
  try {
    token = await getPlatformAccessToken(ltiSession.platformId, [SCOPE_SCORE]);
  } catch (err) {
    log.error({ err, userId: params.userId }, 'AGS token grant failed');
    return { status: 'failed', reason: 'token grant failed' };
  }

  const body = {
    userId: ltiSession.ltiUserId,
    scoreGiven: params.score,
    scoreMaximum,
    activityProgress: params.activityProgress ?? 'Completed',
    gradingProgress: params.gradingProgress,
    timestamp: new Date().toISOString(),
    ...(params.feedback ? { comment: params.feedback } : {}),
  };

  const res = await fetch(scoresUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': CONTENT_TYPE_SCORE,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    log.error(
      { userId: params.userId, status: res.status, body: errText.slice(0, 300) },
      'AGS score POST failed',
    );
    return { status: 'failed', reason: `HTTP ${res.status}` };
  }

  log.info(
    { userId: params.userId, ltiSessionId: ltiSession.id, score: params.score, scoreMaximum },
    'AGS score submitted',
  );
  return { status: 'submitted', lineitemUrl };
}

// Re-export scope strings so admin/test code can reference them without
// drifting from this file's source of truth.
export const AGS_SCOPES = {
  SCORE: SCOPE_SCORE,
  LINEITEM: SCOPE_LINEITEM,
  LINEITEM_READONLY: SCOPE_LINEITEM_RO,
} as const;
