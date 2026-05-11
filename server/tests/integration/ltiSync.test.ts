import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma, resetDatabase } from '../helpers/db.js';
import { ensureToolKey, _resetSigningKeyCache } from '../../src/services/toolKey.service.js';
import { _resetTokenCache } from '../../src/services/lti.service.js';
import { syncCourse, resolvePendingMatch } from '../../src/services/ltiSync.service.js';

const PLATFORM = {
  name: 'Test Moodle',
  issuerUrl: 'https://moodle.test',
  clientId: 'test-client-id',
  authEndpoint: 'https://moodle.test/mod/lti/auth.php',
  tokenEndpoint: 'https://moodle.test/mod/lti/token.php',
  jwksUrl: 'https://moodle.test/mod/lti/certs.php',
  deploymentId: 'dep-1',
};

const MEMBERSHIPS_URL = 'https://moodle.test/mod/lti/services.php/CourseSection/42/bindings/4/memberships';
const LINEITEM_URL = 'https://moodle.test/mod/lti/services.php/2/lineitems/9/lineitem';
const LEARNER_ROLE = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';

function mockNrpsResponse(members: unknown[]) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (url === PLATFORM.tokenEndpoint) {
      return new Response(
        JSON.stringify({ access_token: 'tok', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.startsWith(MEMBERSHIPS_URL)) {
      return new Response(JSON.stringify({ id: 'ctx-1', members }), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json' },
      });
    }
    return new Response(`unexpected ${url}`, { status: 500 });
  });
}

async function seedCourseSync() {
  const platform = await prisma.ltiPlatform.create({ data: PLATFORM });
  const course = await prisma.ltiCourseSync.create({
    data: {
      platformId: platform.id,
      contextId: 'ctx-1',
      contextTitle: 'Curso Ventas 101',
      membershipsUrl: MEMBERSHIPS_URL,
      lineitemUrl: LINEITEM_URL,
    },
  });
  return { platform, course };
}

describe('NRPS course sync — cascading match', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureToolKey();
    _resetSigningKeyCache();
    _resetTokenCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches por email exacto y crea LtiSession con lineitem', async () => {
    const { course, platform } = await seedCourseSync();
    await prisma.user.create({
      data: { email: 'ana@test.local', firstName: 'Ana', lastName: 'García', emailVerified: true },
    });

    mockNrpsResponse([
      {
        user_id: 'lti-ana',
        status: 'Active',
        roles: [LEARNER_ROLE],
        email: 'ana@test.local',
        name: 'Ana García',
      },
    ]);

    const result = await syncCourse(course.id);

    expect(result.matched).toBe(1);
    expect(result.created).toBe(0);
    expect(result.pending).toBe(0);

    const session = await prisma.ltiSession.findFirst({ where: { ltiUserId: 'lti-ana' } });
    expect(session).not.toBeNull();
    expect(session!.platformId).toBe(platform.id);
    expect(session!.agsLineitemUrl).toBe(LINEITEM_URL);
    expect(session!.agsScopes).toContain('https://purl.imsglobal.org/spec/lti-ags/scope/score');
  });

  it('fallback por nombre+apellido cuando email no matchea', async () => {
    const { course } = await seedCourseSync();
    const existing = await prisma.user.create({
      data: { email: 'old@test.local', firstName: 'José', lastName: 'Pérez', emailVerified: true },
    });

    mockNrpsResponse([
      {
        user_id: 'lti-jose',
        status: 'Active',
        roles: [LEARNER_ROLE],
        email: 'jose.nuevo@test.local',
        given_name: 'JOSE',
        family_name: 'perez',
      },
    ]);

    const result = await syncCourse(course.id);

    expect(result.matched).toBe(1);
    expect(result.created).toBe(0);

    const session = await prisma.ltiSession.findFirst({ where: { ltiUserId: 'lti-jose' } });
    expect(session!.userId).toBe(existing.id);
  });

  it('homónimos → LtiPendingMatch (no crea sesión)', async () => {
    const { course } = await seedCourseSync();
    await prisma.user.createMany({
      data: [
        { email: 'jp1@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
        { email: 'jp2@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
      ],
    });

    mockNrpsResponse([
      {
        user_id: 'lti-juan',
        status: 'Active',
        roles: [LEARNER_ROLE],
        // email distinto a los registrados, fuerza fallback a nombre
        email: 'juan.moodle@test.local',
        given_name: 'Juan',
        family_name: 'Pérez',
      },
    ]);

    const result = await syncCourse(course.id);

    expect(result.pending).toBe(1);
    expect(result.matched).toBe(0);
    expect(result.created).toBe(0);

    const pending = await prisma.ltiPendingMatch.findFirst({ where: { ltiUserId: 'lti-juan' } });
    expect(pending).not.toBeNull();
    expect(pending!.candidateUserIds.length).toBe(2);
    expect(pending!.reason).toBe('ambiguous_name');

    // No session yet
    const session = await prisma.ltiSession.findFirst({ where: { ltiUserId: 'lti-juan' } });
    expect(session).toBeNull();
  });

  it('sin match alguno → crea usuario nuevo con learner role', async () => {
    const { course } = await seedCourseSync();

    mockNrpsResponse([
      {
        user_id: 'lti-new',
        status: 'Active',
        roles: [LEARNER_ROLE],
        email: 'nuevo@test.local',
        given_name: 'Nuevo',
        family_name: 'Estudiante',
      },
    ]);

    const result = await syncCourse(course.id);

    expect(result.created).toBe(1);

    const user = await prisma.user.findUnique({
      where: { email: 'nuevo@test.local' },
      include: { roles: true },
    });
    expect(user).not.toBeNull();
    expect(user!.roles[0].role).toBe('learner');
    expect(user!.emailVerified).toBe(true);

    const session = await prisma.ltiSession.findFirst({ where: { ltiUserId: 'lti-new' } });
    expect(session!.userId).toBe(user!.id);
  });

  it('re-sync es idempotente — no duplica sesiones ni pending', async () => {
    const { course } = await seedCourseSync();
    await prisma.user.createMany({
      data: [
        { email: 'jp1@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
        { email: 'jp2@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
      ],
    });

    const members = [
      {
        user_id: 'lti-ana',
        status: 'Active',
        roles: [LEARNER_ROLE],
        email: 'ana@test.local',
        given_name: 'Ana',
        family_name: 'García',
      },
      {
        user_id: 'lti-juan',
        status: 'Active',
        roles: [LEARNER_ROLE],
        email: 'juan.moodle@test.local',
        given_name: 'Juan',
        family_name: 'Pérez',
      },
    ];

    mockNrpsResponse(members);
    await syncCourse(course.id);

    mockNrpsResponse(members);
    await syncCourse(course.id);

    const sessionCount = await prisma.ltiSession.count();
    const pendingCount = await prisma.ltiPendingMatch.count();
    expect(sessionCount).toBe(1); // only ana, juan stays pending
    expect(pendingCount).toBe(1);
  });

  it('filtra miembros inactivos y no-learners', async () => {
    const { course } = await seedCourseSync();

    mockNrpsResponse([
      {
        user_id: 'lti-inactive',
        status: 'Inactive',
        roles: [LEARNER_ROLE],
        email: 'inactive@test.local',
      },
      {
        user_id: 'lti-teacher',
        status: 'Active',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
        email: 'teacher@test.local',
      },
    ]);

    const result = await syncCourse(course.id);

    expect(result.membersFetched).toBe(0); // both filtered
    expect(result.created).toBe(0);
  });

  it('actualiza lastSyncedAt y status=ok tras sync exitoso', async () => {
    const { course } = await seedCourseSync();
    mockNrpsResponse([]);

    await syncCourse(course.id);

    const refreshed = await prisma.ltiCourseSync.findUnique({ where: { id: course.id } });
    expect(refreshed!.lastSyncedAt).not.toBeNull();
    expect(refreshed!.lastSyncStatus).toBe('ok');
    expect(refreshed!.lastSyncError).toBeNull();
  });

  it('lastSyncStatus=error y propaga cuando NRPS responde 401', async () => {
    const { course } = await seedCourseSync();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url === PLATFORM.tokenEndpoint) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      return new Response('unauthorized', { status: 401 });
    });

    await expect(syncCourse(course.id)).rejects.toThrow(/NRPS fetch failed/);

    const refreshed = await prisma.ltiCourseSync.findUnique({ where: { id: course.id } });
    expect(refreshed!.lastSyncStatus).toBe('error');
    expect(refreshed!.lastSyncError).toContain('NRPS fetch failed');
  });
});

describe('resolvePendingMatch', () => {
  beforeEach(async () => {
    await resetDatabase();
    await ensureToolKey();
    _resetSigningKeyCache();
    _resetTokenCache();
  });

  it('crea LtiSession con el userId elegido y marca resolved', async () => {
    const { course, platform } = await seedCourseSync();
    const [u1, u2] = await Promise.all([
      prisma.user.create({
        data: { email: 'jp1@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
      }),
      prisma.user.create({
        data: { email: 'jp2@test.local', firstName: 'Juan', lastName: 'Pérez', emailVerified: true },
      }),
    ]);

    const pending = await prisma.ltiPendingMatch.create({
      data: {
        courseSyncId: course.id,
        ltiUserId: 'lti-juan',
        ltiEmail: 'juan.moodle@test.local',
        ltiName: 'Juan Pérez',
        candidateUserIds: [u1.id, u2.id],
        reason: 'ambiguous_name',
      },
    });

    await resolvePendingMatch(pending.id, u2.id);

    const session = await prisma.ltiSession.findFirst({ where: { ltiUserId: 'lti-juan' } });
    expect(session!.userId).toBe(u2.id);
    expect(session!.platformId).toBe(platform.id);
    expect(session!.agsLineitemUrl).toBe(LINEITEM_URL);

    const refreshed = await prisma.ltiPendingMatch.findUnique({ where: { id: pending.id } });
    expect(refreshed!.resolvedAt).not.toBeNull();
    expect(refreshed!.resolvedUserId).toBe(u2.id);
  });

  it('rechaza userId fuera de la lista de candidatos', async () => {
    const { course } = await seedCourseSync();
    const u1 = await prisma.user.create({
      data: { email: 'u1@test.local', firstName: 'A', lastName: 'B', emailVerified: true },
    });
    const outsider = await prisma.user.create({
      data: { email: 'outsider@test.local', firstName: 'X', lastName: 'Y', emailVerified: true },
    });

    const pending = await prisma.ltiPendingMatch.create({
      data: {
        courseSyncId: course.id,
        ltiUserId: 'lti-juan',
        candidateUserIds: [u1.id],
        reason: 'ambiguous_name',
      },
    });

    await expect(resolvePendingMatch(pending.id, outsider.id)).rejects.toThrow(/not among/);
  });
});
