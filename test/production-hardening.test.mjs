import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const frontend = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('frontend printing and navigation hardening remain in the production build', async () => {
  const [safePrint, app, vercel] = await Promise.all([
    frontend('src/lib/safePrint.js'),
    frontend('src/App.jsx'),
    frontend('vercel.json'),
  ]);
  assert.match(safePrint, /DOMPurify\.sanitize/);
  assert.match(safePrint, /FORBID_TAGS/);
  assert.match(safePrint, /targetWindow\.opener = null/);
  assert.doesNotMatch(app, /const lazyPage/);
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/Dashboard\.jsx'\)\)/);
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /frame-ancestors 'none'/);
});
