'use strict';

const fs = require('fs');
const path = require('path');
const { parseYaml } = require('./yaml');

/**
 * Loading the rules/ files, with results cached per root.
 *
 * A rules file that cannot be read or parsed throws, naming the file. It never
 * degrades to an empty ruleset: a style gate that silently checks nothing is
 * worse than no gate, because it reports success.
 */

const cache = new Map();

function loadYamlFile(absPath, label) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    const err = new Error(`human: cannot read ${label} at ${absPath}: ${e.message}`);
    err.code = 'HUMAN_CONFIG';
    throw err;
  }
  try {
    return parseYaml(raw);
  } catch (e) {
    const err = new Error(`human: cannot parse ${label} (${absPath}): ${e.message}`);
    err.code = 'HUMAN_CONFIG';
    throw err;
  }
}

function loadConfig(rootDir) {
  const root = path.resolve(rootDir);
  if (cache.has(root)) return cache.get(root);

  const invariants = loadYamlFile(path.join(root, 'rules/invariants.yml'), 'invariants.yml');
  const routes = loadYamlFile(path.join(root, 'rules/routes.yml'), 'routes.yml');
  const registers = loadYamlFile(path.join(root, 'rules/registers.yml'), 'registers.yml');

  const vocab = {};
  const vocabDir = path.join(root, 'rules/vocab');
  for (const file of fs.readdirSync(vocabDir)) {
    if (!file.endsWith('.yml')) continue;
    const lang = path.basename(file, '.yml');
    vocab[lang] = loadYamlFile(path.join(vocabDir, file), `vocab/${file}`);
  }

  const config = { root, invariants, routes, registers, vocab };
  cache.set(root, config);
  return config;
}

/** The plugin root, resolved from this file's location. */
function defaultRoot() {
  return path.join(__dirname, '..');
}

module.exports = { loadConfig, defaultRoot, loadYamlFile };
