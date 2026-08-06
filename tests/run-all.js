#!/usr/bin/env node
'use strict';

/**
 * Zero-dependency test runner: walks tests/**\/*.test.js (excluding
 * tests/helpers/, which holds shared fixtures rather than tests), runs each
 * file as its own `node <file>` child process, and aggregates pass/fail.
 *
 * Each *.test.js file is self-contained and exits 0 on success, 1 on any
 * failed case. This script only collects those exit codes.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const TESTS_ROOT = __dirname;
const HELPERS_DIR = path.join(TESTS_ROOT, 'helpers');

function walk(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === HELPERS_DIR) continue;
      walk(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      results.push(full);
    }
  }
  return results;
}

function sanitizedEnv() {
  const env = { ...process.env };
  // Keep the outer repo's git context out of any temp repo a test creates.
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_COMMON_DIR;
  delete env.GIT_PREFIX;
  // A stray HUMAN_SKIP in the developer's shell would silently disable the
  // gate under test, so the suite always runs with it cleared.
  delete env.HUMAN_SKIP;
  return env;
}

function main() {
  const files = walk(TESTS_ROOT, []).sort();
  if (files.length === 0) {
    console.log('No test files found under tests/.');
    process.exit(1);
  }

  const env = sanitizedEnv();
  let failedFiles = 0;

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const result = spawnSync('node', [file], { encoding: 'utf8', timeout: 15000, env });
    if (result.status !== 0 || result.error) failedFiles += 1;

    console.log(`\n=== ${rel} ===`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) console.log(`x failed to spawn: ${result.error.message}`);
    else if (result.signal) console.log(`x terminated by signal ${result.signal}`);
    else if (result.status !== 0) console.log(`x exited with status ${result.status}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log(
    `Test files: ${files.length - failedFiles}/${files.length} passed` +
      (failedFiles > 0 ? `, ${failedFiles} FAILED` : '')
  );
  console.log('='.repeat(50));

  process.exit(failedFiles > 0 ? 1 : 0);
}

main();
