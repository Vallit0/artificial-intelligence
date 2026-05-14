// LTI roster sync orchestrator. Fetches the NRPS membership for each
// active LtiCourseSync, runs the cascading match against `users`, and
// upserts LtiSession rows so future web-only practice/exam attempts post
// grades back to Moodle.
//
// Matching cascade (in order of confidence):
//   1. email exact match — `users.email` is unique, so this is unambiguous
//      when it succeeds.
//   2. normalized name match (lowercased, accent-stripped, single-spaced)
//      against firstName + " " + lastName. Exactly 1 candidate → link;
//      0 candidates → auto-create new user; 2+ candidates → record in
//      LtiPendingMatch and skip until an admin resolves.
//
// Idempotency: re-running sync on the same course is safe. Existing
// LtiSessions are updated in place (lineitem URL / NRPS URL refresh);
// pending matches are upserted by (courseSyncId, ltiUserId) so the same
// ambiguity only generates one row no matter how many times it's seen.

import { Prisma } from '@prisma/client';
import prisma from '../db/index.js';
import { fetchCourseRoster, RosterMember } from './nrps.service.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger({ component: 'lti-sync' });

export interface SyncCourseResult {
  courseSyncId: string;
  membersFetched: number;
  matched: number;        // existing user, LtiSession created/refreshed
  created: number;        // new user auto-created
  pending: number;        // ambiguous name match → LtiPendingMatch row
  skipped: number;        // member had no email and no name; cannot match
  errors: number;
}

// Lowercase, strip combining diacritics, collapse whitespace. Stable
// across "JOSÉ  García" / "jose garcia" / "José García ".
function normalizeName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function fullNameOf(member: RosterMember): string {
  if (member.name) return member.name;
  return [member.givenName, member.familyName].filter(Boolean).join(' ');
}

// Decide which existing User (if any) corresponds to this roster member.
// Returns { kind: "matched", userId } for unambiguous match, "ambiguous"
// when name match returns 2+ candidates, or "none" when there's no match.
type MatchResolution =
  | { kind: 'matched'; userId: string; via: 'email' | 'name' }
  | { kind: 'ambiguous'; candidateUserIds: string[] }
  | { kind: 'none' };

async function resolveMatch(member: RosterMember): Promise<MatchResolution> {
  // Tier 1: email — exact match, case-insensitive (DB stores lowercased
  // when admin creates users, but we don't enforce it on the LTI side).
  if (member.email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: { equals: member.email, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    });
    if (byEmail) return { kind: 'matched', userId: byEmail.id, via: 'email' };
  }

  // Tier 2: normalized first + last name. Only attempt if we have both —
  // a single token ("Juan") matches too many people to be safe even with
  // the ambiguity guard.
  const memberFull = normalizeName(fullNameOf(member));
  const memberGiven = normalizeName(member.givenName);
  const memberFamily = normalizeName(member.familyName);

  if (!memberFull || (!memberGiven && !memberFamily)) {
    return { kind: 'none' };
  }

  // Pull every user with both firstName + lastName set and filter in
  // memory by normalized full name. We can't pre-filter in SQL because
  // Postgres ILIKE doesn't strip accents (no `unaccent` extension
  // installed) — "jose" would miss "José". The table is small enough
  // (low thousands at most) for full scans to stay fast; revisit with a
  // generated normalized column if it ever grows past ~100k.
  const candidates = await prisma.user.findMany({
    where: {
      firstName: { not: null },
      lastName: { not: null },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  const matches = candidates.filter((c) => {
    const candFull = normalizeName([c.firstName, c.lastName].filter(Boolean).join(' '));
    return candFull === memberFull;
  });

  if (matches.length === 0) return { kind: 'none' };
  if (matches.length === 1) return { kind: 'matched', userId: matches[0].id, via: 'name' };
  return { kind: 'ambiguous', candidateUserIds: matches.map((m) => m.id) };
}

// Resuelve la sede a asignar a usuarios auto-creados por NRPS. Prefiere
// LtiCourseSync.defaultSedeId si está seteado; fallback a la primera sede
// activa. Si no hay ninguna sede activa (caso degenerado pre-backfill),
// devolvemos null y el caller hace skip.
async function resolveDefaultSedeId(courseSync: { defaultSedeId: string | null }): Promise<string | null> {
  if (courseSync.defaultSedeId) {
    const sede = await prisma.sede.findFirst({
      where: { id: courseSync.defaultSedeId, isActive: true },
      select: { id: true },
    });
    if (sede) return sede.id;
  }
  const fallback = await prisma.sede.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

// Apply the resolution: upsert LtiSession (matched / created paths) or
// LtiPendingMatch (ambiguous). Idempotent for repeat syncs.
async function applyResolution(
  member: RosterMember,
  resolution: MatchResolution,
  courseSyncId: string,
  platformId: string,
  contextId: string,
  contextTitle: string | null,
  lineitemUrl: string | null,
  membershipsUrl: string,
  defaultSedeId: string | null,
): Promise<'matched' | 'created' | 'pending' | 'skipped'> {
  if (resolution.kind === 'ambiguous') {
    await prisma.ltiPendingMatch.upsert({
      where: {
        courseSyncId_ltiUserId: { courseSyncId, ltiUserId: member.ltiUserId },
      },
      create: {
        courseSyncId,
        ltiUserId: member.ltiUserId,
        ltiEmail: member.email,
        ltiName: fullNameOf(member) || null,
        candidateUserIds: resolution.candidateUserIds,
        reason: 'ambiguous_name',
      },
      update: {
        ltiEmail: member.email,
        ltiName: fullNameOf(member) || null,
        candidateUserIds: resolution.candidateUserIds,
      },
    });
    return 'pending';
  }

  let userId: string;
  let outcome: 'matched' | 'created';

  if (resolution.kind === 'matched') {
    userId = resolution.userId;
    outcome = 'matched';
  } else {
    // Auto-create: needs an email (User.email is required + unique).
    // Without one, we'd have no stable key to upsert against on future
    // syncs and the user couldn't ever sign in via the web link.
    if (!member.email) return 'skipped';
    // Tampoco creamos si no hay sede a la cual asignar — un user sin sede
    // queda bloqueado para todos los endpoints sede-scoped, mejor saltarlo
    // y dejar que el admin registre la sede primero.
    if (!defaultSedeId) {
      log.warn(
        { courseSyncId, ltiUserId: member.ltiUserId },
        'cannot auto-create LTI user — no sede asignable',
      );
      return 'skipped';
    }

    const created = await prisma.user.create({
      data: {
        email: member.email,
        firstName: member.givenName ?? fullNameOf(member).split(' ')[0] ?? null,
        lastName: member.familyName ?? fullNameOf(member).split(' ').slice(1).join(' ') ?? null,
        emailVerified: true,
        sedeId: defaultSedeId,
        roles: { create: { role: 'learner' } },
      },
      select: { id: true },
    });
    userId = created.id;
    outcome = 'created';
  }

  // Upsert the LtiSession so AGS pushes from web-only practice work.
  // contextId/resourceLinkId/etc. mirror what a launch would have set;
  // lineitem can be null if the course has no gradable activity yet.
  await prisma.ltiSession.upsert({
    where: {
      platformId_ltiUserId: { platformId, ltiUserId: member.ltiUserId },
    },
    create: {
      userId,
      platformId,
      ltiUserId: member.ltiUserId,
      ltiEmail: member.email,
      ltiName: fullNameOf(member) || null,
      contextId,
      contextTitle,
      roles: ['learner'],
      agsLineitemUrl: lineitemUrl,
      agsScopes: lineitemUrl
        ? ['https://purl.imsglobal.org/spec/lti-ags/scope/score']
        : [],
      nrpsMembershipsUrl: membershipsUrl,
    },
    update: {
      // Don't clobber userId on re-sync — if a launch already linked the
      // session to a specific user, keep that mapping. Only refresh the
      // mutable LTI metadata.
      ltiEmail: member.email,
      ltiName: fullNameOf(member) || null,
      contextTitle,
      ...(lineitemUrl ? { agsLineitemUrl: lineitemUrl } : {}),
      nrpsMembershipsUrl: membershipsUrl,
    },
  });

  return outcome;
}

export async function syncCourse(courseSyncId: string): Promise<SyncCourseResult> {
  const course = await prisma.ltiCourseSync.findUniqueOrThrow({
    where: { id: courseSyncId },
  });

  if (!course.isActive) {
    throw new Error(`LtiCourseSync ${courseSyncId} is inactive`);
  }

  const result: SyncCourseResult = {
    courseSyncId,
    membersFetched: 0,
    matched: 0,
    created: 0,
    pending: 0,
    skipped: 0,
    errors: 0,
  };

  let fetched: Awaited<ReturnType<typeof fetchCourseRoster>>;
  try {
    fetched = await fetchCourseRoster(course.platformId, course.membershipsUrl);
  } catch (err) {
    await prisma.ltiCourseSync.update({
      where: { id: courseSyncId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: 'error',
        lastSyncError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }

  result.membersFetched = fetched.members.length;
  const defaultSedeId = await resolveDefaultSedeId(course);

  for (const member of fetched.members) {
    try {
      const resolution = await resolveMatch(member);
      const outcome = await applyResolution(
        member,
        resolution,
        courseSyncId,
        course.platformId,
        course.contextId,
        course.contextTitle,
        course.lineitemUrl,
        course.membershipsUrl,
        defaultSedeId,
      );
      result[outcome] += 1;
    } catch (err) {
      result.errors += 1;
      log.error(
        { err, ltiUserId: member.ltiUserId, courseSyncId },
        'roster member sync failed',
      );
    }
  }

  await prisma.ltiCourseSync.update({
    where: { id: courseSyncId },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus: result.errors > 0 ? 'partial' : 'ok',
      lastSyncError: null,
    },
  });

  log.info({ ...result }, 'NRPS course sync completed');
  return result;
}

// Resolve a pending match manually: the admin picked one of the
// candidate users. Creates the LtiSession just like the matched path
// above would have, then marks the pending row resolved.
export async function resolvePendingMatch(
  pendingMatchId: string,
  userId: string,
): Promise<void> {
  const pending = await prisma.ltiPendingMatch.findUniqueOrThrow({
    where: { id: pendingMatchId },
    include: { courseSync: true },
  });

  if (pending.resolvedAt || pending.dismissedAt) {
    throw new Error('Pending match already closed');
  }
  if (!pending.candidateUserIds.includes(userId)) {
    throw new Error('userId is not among the recorded candidates');
  }

  await prisma.ltiSession.upsert({
    where: {
      platformId_ltiUserId: {
        platformId: pending.courseSync.platformId,
        ltiUserId: pending.ltiUserId,
      },
    },
    create: {
      userId,
      platformId: pending.courseSync.platformId,
      ltiUserId: pending.ltiUserId,
      ltiEmail: pending.ltiEmail,
      ltiName: pending.ltiName,
      contextId: pending.courseSync.contextId,
      contextTitle: pending.courseSync.contextTitle,
      roles: ['learner'],
      agsLineitemUrl: pending.courseSync.lineitemUrl,
      agsScopes: pending.courseSync.lineitemUrl
        ? ['https://purl.imsglobal.org/spec/lti-ags/scope/score']
        : [],
      nrpsMembershipsUrl: pending.courseSync.membershipsUrl,
    },
    update: {
      userId,
      ltiEmail: pending.ltiEmail,
      ltiName: pending.ltiName,
    },
  });

  await prisma.ltiPendingMatch.update({
    where: { id: pendingMatchId },
    data: { resolvedAt: new Date(), resolvedUserId: userId },
  });
}

export async function dismissPendingMatch(pendingMatchId: string): Promise<void> {
  await prisma.ltiPendingMatch.update({
    where: { id: pendingMatchId },
    data: { dismissedAt: new Date() },
  });
}

// Test helper.
export const _internals = { normalizeName, resolveMatch };
