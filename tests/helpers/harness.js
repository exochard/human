'use strict';

/**
 * The tiny test harness every *.test.js file uses. Kept in tests/helpers/ so
 * the runner skips it (it is not itself a test file).
 */

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok - ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`  FAIL - ${name}\n    ${e.message}`);
  }
}

function done() {
  process.exit(failures === 0 ? 0 : 1);
}

module.exports = { test, done };
