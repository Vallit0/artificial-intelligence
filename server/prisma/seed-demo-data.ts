/**
 * Seed script for demo data: populates PracticeSession + EvaluationBreakdown
 * + UserScenarioProgress so the "Resumen" section of the Progress page shows
 * call count, total time, streak, average rating, milestones and charts.
 *
 * Usage:
 *   npm run db:seed-demo                       # seeds demo@gmail.com
 *   npm run db:seed-demo -- --email x@y.com    # seeds a specific user
 *   npm run db:seed-demo -- --reset            # wipes prior demo data first
 *   npm run db:seed-demo -- --sessions 30      # override session count
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Args = {
  email: string;
  reset: boolean;
  sessions: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let email = process.env.DEMO_USER_EMAIL || 'demo@gmail.com';
  let reset = false;
  let sessions = 24;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i + 1]) {
      email = argv[++i];
    } else if (a === '--reset') {
      reset = true;
    } else if (a === '--sessions' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10);
      if (!Number.isNaN(n) && n > 0) sessions = n;
    }
  }
  return { email, reset, sessions };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a realistic breakdown of 5 competencies (each 0-20) that roughly
 * sums to `score` (0-100). Adds noise and clamps per competency.
 */
function buildBreakdown(score: number) {
  const target = score / 5; // average per competency
  const raw = Array.from({ length: 5 }, () => {
    const noise = randInt(-4, 4);
    return Math.max(0, Math.min(20, Math.round(target + noise)));
  });
  return {
    apertura: raw[0],
    escuchaActiva: raw[1],
    manejoObjeciones: raw[2],
    propuestaValor: raw[3],
    cierre: raw[4],
  };
}

/**
 * Generate N backdated timestamps across the last ~21 days with:
 * - A streak of 4 consecutive days ending today (so the streak card lights up)
 * - Sparser activity before that
 */
function generateDates(count: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  // 1) Streak: at least 1 session on each of the last 4 days
  for (let daysAgo = 0; daysAgo < 4; daysAgo++) {
    const n = daysAgo === 0 ? 2 : 1; // a couple today
    for (let j = 0; j < n; j++) {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(randInt(9, 20), randInt(0, 59), randInt(0, 59), 0);
      dates.push(d);
    }
  }

  // 2) Scatter the rest across the prior 20 days
  while (dates.length < count) {
    const d = new Date(now);
    d.setDate(d.getDate() - randInt(5, 24));
    d.setHours(randInt(9, 20), randInt(0, 59), randInt(0, 59), 0);
    dates.push(d);
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

async function main() {
  const { email, reset, sessions: sessionCount } = parseArgs();

  console.log(`\nSeeding demo data for user: ${email}`);
  console.log(`  sessions: ${sessionCount}, reset: ${reset}\n`);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User "${email}" not found. Run "npm run db:seed" first or pass --email.`);
    process.exit(1);
  }

  const scenarios = await prisma.scenario.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  if (scenarios.length === 0) {
    console.error('No active scenarios found. Run "npm run db:seed" first.');
    process.exit(1);
  }

  if (reset) {
    const deleted = await prisma.practiceSession.deleteMany({ where: { userId: user.id } });
    await prisma.userScenarioProgress.deleteMany({ where: { userId: user.id } });
    console.log(`Wiped ${deleted.count} prior sessions for this user.\n`);
  }

  const dates = generateDates(sessionCount);
  const perScenarioBestScore = new Map<string, number>();
  const perScenarioAttempts = new Map<string, number>();
  const perScenarioFirstCompleted = new Map<string, Date>();
  const perScenarioLastAttempt = new Map<string, Date>();

  let created = 0;
  for (const createdAt of dates) {
    const scenario = pick(scenarios);
    // Slight upward trend: later sessions tend to score higher
    const idx = dates.indexOf(createdAt);
    const progressFactor = idx / Math.max(1, dates.length - 1); // 0..1
    const baseScore = Math.round(45 + progressFactor * 35 + randInt(-8, 10));
    const score = Math.max(20, Math.min(98, baseScore));
    const passed = score >= 75;
    const durationSeconds = randInt(90, 420); // 1.5 - 7 minutes
    const rating = Math.max(1, Math.min(5, Math.round(score / 20)));
    const breakdown = buildBreakdown(score);

    const session = await prisma.practiceSession.create({
      data: {
        userId: user.id,
        scenarioId: scenario.id,
        durationSeconds,
        score,
        passed,
        rating,
        aiFeedback:
          passed
            ? 'Buen manejo de la objeción y cierre claro. Sigue afinando la escucha activa.'
            : 'Buena apertura, pero conviene trabajar el manejo de objeciones y proponer un siguiente paso.',
        createdAt,
      },
    });

    await prisma.evaluationBreakdown.create({
      data: {
        sessionId: session.id,
        ...breakdown,
      },
    });

    // Track per-scenario aggregates for UserScenarioProgress
    perScenarioAttempts.set(scenario.id, (perScenarioAttempts.get(scenario.id) || 0) + 1);
    perScenarioLastAttempt.set(scenario.id, createdAt);
    if (passed) {
      const best = perScenarioBestScore.get(scenario.id) ?? 0;
      if (score > best) perScenarioBestScore.set(scenario.id, score);
      if (!perScenarioFirstCompleted.has(scenario.id)) {
        perScenarioFirstCompleted.set(scenario.id, createdAt);
      }
    }

    created++;
  }

  console.log(`Created ${created} practice sessions + breakdowns.`);

  // Build UserScenarioProgress so scenarios unlock realistically
  const sortedScenarios = scenarios; // already ordered by displayOrder
  let unlockNext = true; // first is always unlocked
  for (const scenario of sortedScenarios) {
    const attempts = perScenarioAttempts.get(scenario.id) || 0;
    const best = perScenarioBestScore.get(scenario.id);
    const firstCompletedAt = perScenarioFirstCompleted.get(scenario.id) || null;
    const lastAttemptAt = perScenarioLastAttempt.get(scenario.id) || null;
    const isCompleted = best !== undefined;

    await prisma.userScenarioProgress.upsert({
      where: { userId_scenarioId: { userId: user.id, scenarioId: scenario.id } },
      create: {
        userId: user.id,
        scenarioId: scenario.id,
        isUnlocked: unlockNext,
        isCompleted,
        bestScore: best ?? null,
        attempts,
        firstCompletedAt,
        lastAttemptAt,
      },
      update: {
        isUnlocked: unlockNext,
        isCompleted,
        bestScore: best ?? null,
        attempts,
        firstCompletedAt: firstCompletedAt ?? undefined,
        lastAttemptAt: lastAttemptAt ?? undefined,
      },
    });

    // Unlock next only if this one was completed
    unlockNext = isCompleted;
  }

  const totals = await prisma.practiceSession.aggregate({
    where: { userId: user.id },
    _count: true,
    _sum: { durationSeconds: true },
    _avg: { score: true },
  });
  const totalMinutes = Math.round((totals._sum.durationSeconds || 0) / 60);
  const avgScore = Math.round((totals._avg.score || 0) * 10) / 10;

  console.log('\nDemo data summary:');
  console.log(`  total sessions : ${totals._count}`);
  console.log(`  total time     : ${totalMinutes} min`);
  console.log(`  avg score      : ${avgScore}`);
  console.log('\nDone. Refresh the Progress page to see the Resumen populated.\n');
}

main()
  .catch((e) => {
    console.error('Demo seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
