'use strict';

/**
 * Status-ledger pattern: a set of fictional service checks (mocked, no real
 * network calls) is compared against an expected/declared state, drift is
 * detected, and a STATUS.md is generated as the single source of truth for
 * "what do we currently believe is true about this system".
 */

/**
 * @typedef {object} ServiceExpectation
 * @property {string} name
 * @property {string} host        e.g. "192.0.2.10"
 * @property {'up'|'down'} expectedState
 */

/**
 * @typedef {object} ServiceObservation
 * @property {string} name
 * @property {'up'|'down'} observedState
 * @property {string} checkedAt  ISO timestamp
 */

/**
 * Compare expectations to observations and classify each service as
 * 'ok' (matches expectation) or 'drift' (does not match), plus 'unknown'
 * if no observation was provided for an expected service.
 */
function detectDrift(expectations, observations) {
  const observationByName = new Map(observations.map((o) => [o.name, o]));
  return expectations.map((exp) => {
    const obs = observationByName.get(exp.name);
    if (!obs) {
      return { name: exp.name, status: 'unknown', expected: exp.expectedState, observed: null };
    }
    const status = obs.observedState === exp.expectedState ? 'ok' : 'drift';
    return { name: exp.name, status, expected: exp.expectedState, observed: obs.observedState, checkedAt: obs.checkedAt };
  });
}

/**
 * Run the mock checks for a list of service expectations. This never makes
 * a real network call — `checkFn` is injected so tests (and this demo) can
 * supply deterministic fictional results.
 */
function runChecks(expectations, checkFn) {
  return expectations.map((exp) => {
    const observedState = checkFn(exp);
    return { name: exp.name, observedState, checkedAt: new Date().toISOString() };
  });
}

/** Render a STATUS.md document from a drift report. */
function renderStatusMarkdown(driftReport, { generatedAt = new Date().toISOString() } = {}) {
  const lines = [];
  lines.push('# STATUS');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('| Service | Expected | Observed | Status |');
  lines.push('|---|---|---|---|');
  for (const row of driftReport) {
    const observed = row.observed === null ? '(no observation)' : row.observed;
    const statusLabel = { ok: '✅ ok', drift: '⚠️ DRIFT', unknown: '❓ unknown' }[row.status];
    lines.push(`| ${row.name} | ${row.expected} | ${observed} | ${statusLabel} |`);
  }
  const driftCount = driftReport.filter((r) => r.status === 'drift').length;
  const unknownCount = driftReport.filter((r) => r.status === 'unknown').length;
  lines.push('');
  if (driftCount === 0 && unknownCount === 0) {
    lines.push('All services match their expected state.');
  } else {
    lines.push(`${driftCount} service(s) drifted from expectation; ${unknownCount} service(s) have no observation.`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { detectDrift, runChecks, renderStatusMarkdown };
