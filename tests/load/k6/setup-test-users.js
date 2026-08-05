/**
 * Setup Script: Create 15 test users for load testing
 *
 * Run BEFORE the load test:
 *   k6 run tests/load/setup-test-users.js
 *   k6 run --env BASE_URL=https://centro-de-negocios.org tests/load/setup-test-users.js
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  iterations: 15,
};

export default function () {
  const i = __ITER + 1;
  const user = {
    name: `Load Test User ${i}`,
    email: `loadtest_user_${i}@test.com`,
    password: 'LoadTest2024!',
  };

  const res = http.post(`${BASE_URL}/auth/signup`, JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    [`user_${i}: created or exists`]: (r) => r.status === 201 || r.status === 200 || r.status === 409,
  });

  console.log(`User ${i}: ${res.status} - ${user.email}`);
}
