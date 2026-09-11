'use strict';

const { makeResult } = require('./rules/result');

/**
 * Register-scoped mechanical checks.
 *
 * These read doc.raw rather than doc.prose, because what they measure is
 * markup: bullet shape, heading decoration, the opening words of a commit.
 * Prose extraction deliberately destroys exactly that information.
 *
 * An unknown register returns no results rather than throwing. The agent may
 * name a register the config has never heard of, and that should degrade to
 * "invariants only", not to a crash.
 *
 * An unknown check id inside a known register is different: that is a config
 * error, not a style finding. It cannot gate what it cannot run, so it says
 * so on stderr and the scan continues. Skipping it in silence is how a typo
 * ships and a budget quietly stops applying.
 */

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
const COMMIT_OPENER = /^\s*(?:this commit|in this commit|this change|this pr|this patch)\b/i;

function bulletsOf(raw) {
  return String(raw).split('\n').filter((l) => /^\s*[-*+]\s+\S/.test(l));
}

function headingsOf(raw) {
  return String(raw).split('\n').filter((l) => /^\s{0,3}#{1,6}\s+\S/.test(l));
}

function stub(id, gates, fields) {
  return makeResult({ id, confidence: 'moderate', gates }, fields);
}

const CHECKS = {
  'bolded-bullets'(doc, cfg) {
    const bullets = bulletsOf(doc.raw);
    const bolded = bullets.filter((l) => /^\s*[-*+]\s+\*\*/.test(l));
    const minBullets = cfg.minBullets || 3;
    const ratio = bullets.length ? Math.round((bolded.length / bullets.length) * 100) / 100 : 0;
    const over = bullets.length >= minBullets && ratio > cfg.maxRatio;

    return stub('bolded-bullets', cfg.gates !== false, {
      count: bolded.length,
      rate: ratio,
      budget: cfg.maxRatio,
      over,
      hits: over ? bolded.slice(0, 3).map((t) => ({ line: 0, text: t.trim().slice(0, 60) })) : [],
      message: over
        ? `${bolded.length} of ${bullets.length} bullets open with a bolded lead-in (${ratio}, budget ${cfg.maxRatio}). Almost nobody formats a list this way by hand.`
        : `${bolded.length} of ${bullets.length} bullets have a bolded lead-in.`,
    });
  },

  'emoji-heading'(doc, cfg) {
    const hits = headingsOf(doc.raw).filter((h) => EMOJI.test(h));
    const over = hits.length > (cfg.budget || 0);
    return stub('emoji-heading', cfg.gates !== false, {
      count: hits.length,
      rate: hits.length,
      budget: cfg.budget || 0,
      over,
      hits: hits.slice(0, 3).map((t) => ({ line: 0, text: t.trim().slice(0, 60) })),
      message: over
        ? `${hits.length} headings carry an emoji (budget ${cfg.budget || 0}).`
        : 'no emoji in headings.',
    });
  },

  'commit-opener'(doc, cfg) {
    const firstLine = String(doc.raw).split('\n')[0] || '';
    const body = String(doc.raw).split('\n').slice(1).join('\n');
    const hit = COMMIT_OPENER.test(firstLine) || COMMIT_OPENER.test(body.trim());
    return stub('commit-opener', cfg.gates !== false, {
      count: hit ? 1 : 0,
      rate: hit ? 1 : 0,
      budget: 0,
      over: hit,
      hits: hit ? [{ line: 1, text: firstLine.trim().slice(0, 60) }] : [],
      message: hit
        ? 'the message opens by announcing itself ("this commit ..."). Say what changed and why instead.'
        : 'no self-announcing opener.',
    });
  },

  'bullet-per-file'(doc, cfg) {
    const pathish = bulletsOf(doc.raw).filter((l) => {
      const text = l.replace(/^\s*[-*+]\s+/, '').replace(/\*\*/g, '').trim();
      const words = text.split(/\s+/).filter(Boolean);
      // A bullet that is mostly one file path adds nothing over the diff stat.
      return words.length <= 6 && /(?:^|\s)[\w./-]+\.[a-z]{1,5}(?:\s|:|$)/i.test(text);
    });
    const over = pathish.length > cfg.budget;
    return stub('bullet-per-file', cfg.gates !== false, {
      count: pathish.length,
      rate: pathish.length,
      budget: cfg.budget,
      over,
      hits: pathish.slice(0, 3).map((t) => ({ line: 0, text: t.trim().slice(0, 60) })),
      message: over
        ? `${pathish.length} bullets restate a changed file (budget ${cfg.budget}). A reviewer already has the diff stat.`
        : `${pathish.length} file-restating bullets.`,
    });
  },
};

function runRegister(doc, registerName, registersConfig) {
  const registers = (registersConfig && registersConfig.registers) || {};
  const entry = registers[registerName];
  if (!entry || !entry.checks) return [];

  const results = [];
  for (const [id, cfg] of Object.entries(entry.checks)) {
    const check = CHECKS[id];
    if (!check) {
      process.stderr.write(`human: register "${registerName}" names unknown check "${id}"; skipping it\n`);
      continue;
    }
    results.push(check(doc, cfg || {}));
  }
  return results;
}

module.exports = { runRegister, CHECKS };
