'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectDrift, runChecks, renderStatusMarkdown } = require('./ledger.js');

const EXPECTATIONS = [
  { name: 'web-frontend', host: '192.0.2.10', expectedState: 'up' },
  { name: 'batch-worker', host: '192.0.2.11', expectedState: 'up' },
  { name: 'legacy-archiver', host: '192.0.2.12', expectedState: 'down' },
];

test('detectDrift marks matching expectation/observation as ok', () => {
  const observations = [
    { name: 'web-frontend', observedState: 'up', checkedAt: '2026-01-01T00:00:00Z' },
  ];
  const [row] = detectDrift([EXPECTATIONS[0]], observations);
  assert.equal(row.status, 'ok');
});

test('detectDrift marks a mismatch as drift', () => {
  const observations = [
    { name: 'web-frontend', observedState: 'down', checkedAt: '2026-01-01T00:00:00Z' },
  ];
  const [row] = detectDrift([EXPECTATIONS[0]], observations);
  assert.equal(row.status, 'drift');
  assert.equal(row.expected, 'up');
  assert.equal(row.observed, 'down');
});

test('detectDrift marks a service with no observation as unknown', () => {
  const [row] = detectDrift([EXPECTATIONS[0]], []);
  assert.equal(row.status, 'unknown');
  assert.equal(row.observed, null);
});

test('runChecks never performs a real network call; it delegates to the injected checkFn', () => {
  let callCount = 0;
  const checkFn = (exp) => {
    callCount += 1;
    // Deterministic fictional result, no fetch/http/net usage anywhere.
    return exp.name === 'legacy-archiver' ? 'up' : 'up';
  };
  const observations = runChecks(EXPECTATIONS, checkFn);
  assert.equal(callCount, EXPECTATIONS.length);
  assert.equal(observations.length, EXPECTATIONS.length);
  assert.ok(observations.every((o) => typeof o.checkedAt === 'string'));
});

test('end to end: a mocked drift scenario produces exactly one drift row', () => {
  const checkFn = (exp) => {
    if (exp.name === 'legacy-archiver') return 'up'; // expected down -> drift
    return exp.expectedState; // everyone else matches expectation
  };
  const observations = runChecks(EXPECTATIONS, checkFn);
  const report = detectDrift(EXPECTATIONS, observations);

  const driftRows = report.filter((r) => r.status === 'drift');
  assert.equal(driftRows.length, 1);
  assert.equal(driftRows[0].name, 'legacy-archiver');
});

test('renderStatusMarkdown produces a markdown table with a summary line', () => {
  const report = detectDrift(EXPECTATIONS, [
    { name: 'web-frontend', observedState: 'up', checkedAt: '2026-01-01T00:00:00Z' },
    { name: 'batch-worker', observedState: 'down', checkedAt: '2026-01-01T00:00:00Z' },
  ]);
  const md = renderStatusMarkdown(report, { generatedAt: '2026-01-01T00:00:00Z' });

  assert.ok(md.includes('# STATUS'));
  assert.ok(md.includes('web-frontend'));
  assert.ok(md.includes('⚠️ DRIFT'), 'batch-worker mismatch should render as DRIFT');
  assert.ok(md.includes('❓ unknown'), 'legacy-archiver has no observation and should render as unknown');
  assert.ok(md.includes('1 service(s) drifted'));
});

test('renderStatusMarkdown reports all-clear when everything matches', () => {
  const report = detectDrift(EXPECTATIONS, [
    { name: 'web-frontend', observedState: 'up', checkedAt: '2026-01-01T00:00:00Z' },
    { name: 'batch-worker', observedState: 'up', checkedAt: '2026-01-01T00:00:00Z' },
    { name: 'legacy-archiver', observedState: 'down', checkedAt: '2026-01-01T00:00:00Z' },
  ]);
  const md = renderStatusMarkdown(report, { generatedAt: '2026-01-01T00:00:00Z' });
  assert.ok(md.includes('All services match their expected state.'));
});
