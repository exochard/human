'use strict';

/**
 * Path to register, by a deliberately narrow glob.
 *
 * `*` matches inside a path segment, `**` matches across segments, and
 * everything else is literal. That is all routes.yml needs, and a narrow
 * matcher is one whose failures are obvious. First match wins.
 *
 * No match is not an error. It returns matched:false, which is the signal for
 * the agent to apply the rubric in SKILL.md and name the register itself.
 */

function globToRegex(glob) {
  let out = '';
  let i = 0;

  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob.slice(i, i + 3) === '**/') { out += '(?:.*/)?'; i += 3; continue; }
      if (glob.slice(i, i + 2) === '**') { out += '.*'; i += 2; continue; }
      out += '[^/]*'; i += 1; continue;
    }
    out += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

function normalize(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '');
}

function routeFor(relPath, routesConfig) {
  const routes = (routesConfig && routesConfig.routes) || [];
  const target = normalize(relPath);

  for (const route of routes) {
    if (!route || !route.match) continue;
    if (globToRegex(route.match).test(target)) {
      return { register: route.register, matched: true, via: route.match };
    }
  }
  return { register: null, matched: false, via: null };
}

module.exports = { routeFor, globToRegex };
