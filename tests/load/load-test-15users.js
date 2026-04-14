/**
 * Load Test: 15 Concurrent Users - Centro de Negocios
 *
 * Tool: k6 (https://k6.io)
 * Install: winget install k6 / brew install k6 / choco install k6
 *
 * Run:
 *   k6 run tests/load/load-test-15users.js
 *   k6 run --env BASE_URL=https://centro-de-negocios.org tests/load/load-test-15users.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================
// Custom Metrics
// ============================================
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration', true);
const apiDuration = new Trend('api_duration', true);
const pageLoadDuration = new Trend('page_load_duration', true);
const elevenlabsTokenDuration = new Trend('elevenlabs_token_duration', true);
const dbQueryCount = new Counter('db_queries');

// ============================================
// Configuration
// ============================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  // ---- Scenario: Ramp up to 15 users ----
  scenarios: {
    // Scenario 1: Gradual ramp-up (simulates users joining over time)
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },    // First 5 users arrive
        { duration: '30s', target: 10 },   // Next 5 join
        { duration: '30s', target: 15 },   // All 15 connected
        { duration: '3m', target: 15 },    // Sustained load for 3 minutes
        { duration: '30s', target: 0 },    // Gradual exit
      ],
      gracefulRampDown: '10s',
    },

    // Scenario 2: Spike test (all 15 at once, like a meeting start)
    spike: {
      executor: 'constant-vus',
      vus: 15,
      duration: '2m',
      startTime: '5m30s', // Starts after ramp_up finishes
    },
  },

  // ---- SLA Thresholds ----
  thresholds: {
    http_req_duration: [
      'p(95)<2000',   // 95% of requests under 2s
      'p(99)<5000',   // 99% under 5s
    ],
    http_req_failed: ['rate<0.01'],        // Less than 1% error rate
    errors: ['rate<0.05'],                  // Custom error rate under 5%
    login_duration: ['p(95)<3000'],         // Login under 3s (95th percentile)
    api_duration: ['p(95)<1500'],           // API calls under 1.5s
    elevenlabs_token_duration: ['p(95)<4000'], // ElevenLabs token under 4s
    http_reqs: ['rate>5'],                  // At least 5 req/s throughput
  },
};

// ============================================
// Test Data: Simulated Users
// ============================================
const TEST_USERS = Array.from({ length: 15 }, (_, i) => ({
  email: `loadtest_user_${i + 1}@test.com`,
  password: 'LoadTest2024!',
  name: `Load Test User ${i + 1}`,
}));

// ============================================
// Helper Functions
// ============================================
function getHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function checkResponse(res, name) {
  const success = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name}: response time < 3s`]: (r) => r.timings.duration < 3000,
    [`${name}: has body`]: (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!success);
  return success;
}

// ============================================
// Main Test Flow (per virtual user)
// ============================================
export default function () {
  const user = TEST_USERS[__VU % TEST_USERS.length];
  let token = null;

  // ---- 1. Load Homepage (static assets) ----
  group('01_Page_Load', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/`);
    pageLoadDuration.add(Date.now() - start);
    checkResponse(res, 'Homepage');
  });

  sleep(1);

  // ---- 2. Health Check ----
  group('02_Health_Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
    });
  });

  // ---- 3. Login ----
  group('03_Login', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: getHeaders() }
    );
    loginDuration.add(Date.now() - start);

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        token = body.accessToken || body.token;
      } catch (e) {
        // Login may fail for test users that don't exist
      }
    }

    // Even if login fails (users may not exist), track the response time
    check(res, {
      'login: server responded': (r) => r.status > 0,
      'login: not a server error': (r) => r.status < 500,
      'login: response time < 3s': (r) => r.timings.duration < 3000,
    });
  });

  sleep(1);

  // ---- 4. Fetch Scenarios (main API call) ----
  group('04_Get_Scenarios', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/scenarios`, {
      headers: getHeaders(token),
    });
    apiDuration.add(Date.now() - start);
    dbQueryCount.add(1);
    checkResponse(res, 'Scenarios');
  });

  sleep(0.5);

  // ---- 5. Fetch User Progress ----
  if (token) {
    group('05_Get_Progress', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/api/progress`, {
        headers: getHeaders(token),
      });
      apiDuration.add(Date.now() - start);
      dbQueryCount.add(1);
      checkResponse(res, 'Progress');
    });

    sleep(0.5);

    // ---- 6. Request ElevenLabs Conversation Token ----
    group('06_ElevenLabs_Token', () => {
      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/api/elevenlabs/conversation-token`,
        JSON.stringify({}),
        { headers: getHeaders(token) }
      );
      elevenlabsTokenDuration.add(Date.now() - start);
      check(res, {
        'elevenlabs: server responded': (r) => r.status > 0,
        'elevenlabs: not a server error': (r) => r.status < 500,
      });
    });

    sleep(1);

    // ---- 7. Simulate Conversation Activity ----
    // (API calls during a voice session: memory reads, saves)
    group('07_Conversation_Activity', () => {
      // Read advisor memory
      const start = Date.now();
      const memRes = http.get(`${BASE_URL}/api/memory/advisor/1`, {
        headers: getHeaders(token),
      });
      apiDuration.add(Date.now() - start);
      dbQueryCount.add(1);

      sleep(2); // Simulates user talking for a bit

      // Save session summary (end of conversation)
      const sessionRes = http.post(
        `${BASE_URL}/api/sessions`,
        JSON.stringify({
          scenarioId: 1,
          transcript: 'Load test transcript - simulated conversation',
          duration: 120,
        }),
        { headers: getHeaders(token) }
      );
      apiDuration.add(sessionRes.timings.duration);
      dbQueryCount.add(1);
    });
  }

  sleep(2); // Think time between iterations

  // ---- 8. Concurrent API Burst (simulates UI refresh) ----
  group('08_Concurrent_Burst', () => {
    const responses = http.batch([
      ['GET', `${BASE_URL}/health`, null, { headers: getHeaders() }],
      ['GET', `${BASE_URL}/api/scenarios`, null, { headers: getHeaders(token) }],
    ]);
    responses.forEach((r, i) => {
      check(r, {
        [`burst_${i}: status ok`]: (res) => res.status < 500,
      });
    });
  });

  sleep(1);
}

// ============================================
// Summary Report
// ============================================
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    testConfig: {
      targetUsers: 15,
      baseUrl: BASE_URL,
    },
    results: {
      totalRequests: data.metrics.http_reqs?.values?.count || 0,
      avgResponseTime: Math.round(data.metrics.http_req_duration?.values?.avg || 0),
      p95ResponseTime: Math.round(data.metrics.http_req_duration?.values?.['p(95)'] || 0),
      p99ResponseTime: Math.round(data.metrics.http_req_duration?.values?.['p(99)'] || 0),
      errorRate: (data.metrics.http_req_failed?.values?.rate || 0) * 100,
      requestsPerSecond: Math.round((data.metrics.http_reqs?.values?.rate || 0) * 100) / 100,
    },
    slaCompliance: {
      p95Under2s: (data.metrics.http_req_duration?.values?.['p(95)'] || 0) < 2000,
      errorRateUnder1Pct: (data.metrics.http_req_failed?.values?.rate || 0) < 0.01,
      minThroughput: (data.metrics.http_reqs?.values?.rate || 0) > 5,
    },
  };

  return {
    'tests/load/results/summary.json': JSON.stringify(summary, null, 2),
    stdout: generateTextReport(summary),
  };
}

function generateTextReport(summary) {
  const sla = summary.slaCompliance;
  const r = summary.results;
  const pass = (v) => v ? 'PASS ✓' : 'FAIL ✗';

  return `
╔══════════════════════════════════════════════════════════╗
║     LOAD TEST REPORT - Centro de Negocios                ║
║     15 Concurrent Users                                  ║
╚══════════════════════════════════════════════════════════╝

  Target URL:       ${summary.testConfig.baseUrl}
  Timestamp:        ${summary.timestamp}
  Total Requests:   ${r.totalRequests}
  Requests/sec:     ${r.requestsPerSecond}

  ── Response Times ──────────────────────────────────────
  Average:          ${r.avgResponseTime} ms
  P95:              ${r.p95ResponseTime} ms
  P99:              ${r.p99ResponseTime} ms
  Error Rate:       ${r.errorRate.toFixed(2)}%

  ── SLA Compliance ──────────────────────────────────────
  P95 < 2s:         ${pass(sla.p95Under2s)}
  Error Rate < 1%:  ${pass(sla.errorRateUnder1Pct)}
  Throughput > 5/s: ${pass(sla.minThroughput)}

  ── Overall ─────────────────────────────────────────────
  SLA Status:       ${Object.values(sla).every(v => v) ? 'ALL SLA TARGETS MET ✓' : 'SLA VIOLATIONS DETECTED ✗'}
═══════════════════════════════════════════════════════════
`;
}
