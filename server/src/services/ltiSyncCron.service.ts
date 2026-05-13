// Periodic NRPS roster sync. Iterates every active LtiCourseSync and runs
// syncCourse against each, sequentially to avoid hammering Moodle when many
// courses are registered. Runs on the schedule defined by
// LTI_NRPS_CRON_SCHEDULE (default: every 6 hours). Opt-in via
// LTI_NRPS_CRON_ENABLED — left off by default so test/dev environments
// never touch a real LMS without explicit configuration.

import cron, { ScheduledTask } from 'node-cron';
import prisma from '../db/index.js';
import { syncCourse } from './ltiSync.service.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger({ component: 'lti-sync-cron' });

const DEFAULT_SCHEDULE = '0 */6 * * *';

let task: ScheduledTask | null = null;
let running = false;

export interface CronTickResult {
  startedAt: Date;
  finishedAt: Date;
  coursesProcessed: number;
  coursesSucceeded: number;
  coursesFailed: number;
}

// Run one tick: pick up every active LtiCourseSync and sync sequentially.
// Exported so an admin endpoint can also trigger the same code path
// (useful for "sync everything now" without waiting for the next cron
// firing). Returns aggregated counters; per-course details are in logs.
export async function runNrpsSyncTick(): Promise<CronTickResult> {
  if (running) {
    log.warn('NRPS cron tick skipped — previous tick still in flight');
    return {
      startedAt: new Date(),
      finishedAt: new Date(),
      coursesProcessed: 0,
      coursesSucceeded: 0,
      coursesFailed: 0,
    };
  }

  running = true;
  const startedAt = new Date();
  let coursesSucceeded = 0;
  let coursesFailed = 0;

  try {
    const courses = await prisma.ltiCourseSync.findMany({
      where: { isActive: true },
      select: { id: true, contextId: true, platformId: true },
    });

    log.info({ count: courses.length }, 'NRPS cron tick — scanning active courses');

    for (const course of courses) {
      try {
        const result = await syncCourse(course.id);
        coursesSucceeded += 1;
        log.info(
          {
            courseSyncId: course.id,
            contextId: course.contextId,
            membersFetched: result.membersFetched,
            matched: result.matched,
            created: result.created,
            pending: result.pending,
            skipped: result.skipped,
            errors: result.errors,
          },
          'NRPS cron course synced',
        );
      } catch (err) {
        coursesFailed += 1;
        log.error(
          { err, courseSyncId: course.id, contextId: course.contextId },
          'NRPS cron course sync failed',
        );
      }
    }

    return {
      startedAt,
      finishedAt: new Date(),
      coursesProcessed: courses.length,
      coursesSucceeded,
      coursesFailed,
    };
  } finally {
    running = false;
  }
}

export function startNrpsCron(): void {
  if (process.env.LTI_NRPS_CRON_ENABLED !== 'true') {
    log.info('NRPS cron disabled (LTI_NRPS_CRON_ENABLED != "true")');
    return;
  }

  const schedule = process.env.LTI_NRPS_CRON_SCHEDULE || DEFAULT_SCHEDULE;

  if (!cron.validate(schedule)) {
    log.error({ schedule }, 'Invalid LTI_NRPS_CRON_SCHEDULE — cron not started');
    return;
  }

  if (task) {
    log.warn('NRPS cron already started — replacing existing schedule');
    task.stop();
    task = null;
  }

  task = cron.schedule(
    schedule,
    () => {
      runNrpsSyncTick().catch((err) => {
        log.error({ err }, 'NRPS cron tick threw at top level');
      });
    },
    { timezone: process.env.LTI_NRPS_CRON_TZ || 'UTC' },
  );

  log.info({ schedule }, 'NRPS cron started');
}

export function stopNrpsCron(): void {
  if (task) {
    task.stop();
    task = null;
    log.info('NRPS cron stopped');
  }
}
