#!/usr/bin/env node
'use strict';

/**
 * Generates STATUS.md from a fixed set of fictional service expectations,
 * using a mock check function (no real network calls — everything is
 * simulated). Run: node cli.js [--drift] > STATUS.md
 */

const fs = require('node:fs');
const path = require('node:path');
const { detectDrift, runChecks, renderStatusMarkdown } = require('./ledger.js');

const EXPECTATIONS = [
  { name: 'web-frontend', host: '192.0.2.10', expectedState: 'up' },
  { name: 'batch-worker', host: '192.0.2.11', expectedState: 'up' },
  { name: 'legacy-archiver', host: '192.0.2.12', expectedState: 'down' },
];

const simulateDrift = process.argv.includes('--drift');

function mockCheck(exp) {
  if (simulateDrift && exp.name === 'batch-worker') return 'down'; // pretend it's unexpectedly down
  return exp.expectedState;
}

const observations = runChecks(EXPECTATIONS, mockCheck);
const report = detectDrift(EXPECTATIONS, observations);
const markdown = renderStatusMarkdown(report);

const outPath = path.join(__dirname, 'STATUS.generated.md');
fs.writeFileSync(outPath, markdown);
console.log(markdown);
console.log(`Written to ${outPath}`);
