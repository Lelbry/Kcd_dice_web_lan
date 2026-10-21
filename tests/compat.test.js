// Players open the game in old Android browsers (Yandex Browser 19.6 = Chrome 74).
// Syntax newer than that kills every module on the page, so keep it out of public/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function files(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}

const JS_BANNED = [
  [/\?\.(?!\d)/, 'optional chaining ?. (Chrome 80)'],
  [/\?\?/, 'nullish coalescing ?? (Chrome 80)'],
  [/\|\|=|&&=/, 'logical assignment (Chrome 85)'],
  [/\.replaceAll\(/, 'String.replaceAll (Chrome 85)'],
  [/\.at\(/, 'Array.at (Chrome 92)'],
  [/Object\.hasOwn\(/, 'Object.hasOwn (Chrome 93)'],
  [/structuredClone\(/, 'structuredClone (Chrome 98)'],
];

test('client JS runs in Chrome 74', () => {
  for (const f of [...files('public/js', '.js'), 'server/engine/badges.js', 'server/engine/dice-types.js', 'server/engine/rules.js', 'server/engine/scoring.js']) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const [re, what] of JS_BANNED) {
        assert.ok(!re.test(line), `${f}:${i + 1} uses ${what}: ${line.trim()}`);
      }
    });
  }
});

test('CSS has no layout-critical properties newer than Chrome 74', () => {
  for (const f of files('public/styles', '.css')) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      assert.ok(!/^\s*inset\s*:/.test(line), `${f}:${i + 1} uses inset (Chrome 87): ${line.trim()}`);
    });
  }
});
