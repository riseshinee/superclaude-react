#!/usr/bin/env node
// Builds a compact project map (routes, exports, tags, fan-in, test coverage) so skills can grep one file
// instead of globbing and reading the source tree. Zero dependencies.
// Usage: node build-map.mjs [projectDir] [--out <file>] [--stdout] [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};
const optionValues = new Set(['--out'].map(option).filter(Boolean));
const startDir = resolve(args.find((a) => !a.startsWith('--') && !optionValues.has(a)) ?? process.cwd());

function findUp(file, from) {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, file))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const root = findUp('package.json', startDir);
if (!root) {
  console.error(`package.json not found from: ${startDir}`);
  process.exit(1);
}
const outFile = resolve(root, option('--out') ?? '.claude/cache/react-map.md');

// --- Collect files ---
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.expo', '.turbo', '.vercel', '.output', '.cache', '.claude',
  '.svelte-kit', 'dist', 'build', 'out', 'coverage', 'storybook-static', 'public', 'android', 'ios', '__generated__',
]);
const SOURCE_RE = /\.(tsx|ts|jsx|js|mjs)$/;
const SKIP_FILE_RE = /(\.d\.ts|\.gen\.[jt]s|\.min\.js)$|^[^/]*\.config\.[^/]+$|^[^/]*rc\.[cm]?js$/;
const TEST_RE = /(\.(test|spec)\.[jt]sx?$)|(^|\/)__tests__\//;
const STORY_RE = /\.stories\.[jt]sx?$/;
const MOCK_RE = /(^|\/)__mocks__\//;

const sources = [];
const tests = [];
let stories = 0;
const fingerprint = createHash('sha1');

function walk(dir) {
  // Files before subfolders so each folder's own files group together in the output
  const entries = readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.isDirectory() - b.isDirectory() || a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name));
      continue;
    }
    if (!e.isFile() || !SOURCE_RE.test(e.name)) continue;
    const abs = join(dir, e.name);
    const rel = relative(root, abs).replace(/\\/g, '/');
    if (SKIP_FILE_RE.test(rel) || MOCK_RE.test(rel)) continue;
    const st = statSync(abs);
    fingerprint.update(`${rel}|${st.size}|${Math.floor(st.mtimeMs)}\n`);
    if (TEST_RE.test(rel)) tests.push(rel);
    else if (STORY_RE.test(rel)) stories++;
    else sources.push(rel);
  }
}
walk(root);
for (const f of ['package.json', 'tsconfig.json', 'jsconfig.json']) {
  if (existsSync(join(root, f))) fingerprint.update(`${f}|${readFileSync(join(root, f), 'utf8')}\n`);
}
const hash = fingerprint.digest('hex').slice(0, 12);

if (flag('--check')) {
  const head = existsSync(outFile) ? readFileSync(outFile, 'utf8').slice(0, 300) : '';
  const m = head.match(/fingerprint: ([0-9a-f]+)/);
  const rel = relative(root, outFile).replace(/\\/g, '/');
  if (m && m[1] === hash) {
    console.log(`fresh ${rel}`);
    process.exit(0);
  }
  console.log(m ? `stale ${rel}` : `missing ${rel}`);
  process.exit(2);
}

// --- Path aliases (tsconfig/jsconfig paths) ---
function stripJsonComments(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      out += text.slice(start, i + 1);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) break;
      i++;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

const aliases = [];
for (const f of ['tsconfig.json', 'jsconfig.json']) {
  if (!existsSync(join(root, f))) continue;
  try {
    const opts = JSON.parse(stripJsonComments(readFileSync(join(root, f), 'utf8'))).compilerOptions ?? {};
    const base = opts.baseUrl ?? '.';
    for (const [key, targets] of Object.entries(opts.paths ?? {})) {
      if (!key.endsWith('/*') || !targets[0]?.endsWith('/*')) continue;
      aliases.push([key.slice(0, -1), posix.normalize(posix.join(base, targets[0].slice(0, -1)))]);
    }
  } catch {
    // Unparseable config: fall back to the common aliases below
  }
  break;
}
if (!aliases.length) {
  const srcBase = existsSync(join(root, 'src')) ? 'src/' : '';
  aliases.push(['@/', srcBase], ['~/', srcBase]);
}

const sourceSet = new Set(sources);
const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.mjs'];
function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(from), spec));
  else {
    const alias = aliases.find(([prefix]) => spec.startsWith(prefix));
    if (!alias) return null;
    base = posix.normalize(alias[1] + spec.slice(alias[0].length));
  }
  base = base.replace(/^\.\//, '');
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => `${base}/index${e}`)];
  return candidates.find((c) => sourceSet.has(c)) ?? null;
}

// --- Analyze each source file ---
const IMPORT_RE = /(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const TAGS = [
  ['client', /^\s*['"]use client['"]/],
  ['server', /^\s*['"]use server['"]/m],
  ['ctx', /\bcreateContext\s*[<(]/],
  ['store', /\bcreateSlice\s*\(|\bdefineStore\s*\(|\b(?:create|createStore)\s*(?:<[^>]*>)?\s*\(\s*(?:\(\s*)?set\b|\batom(?:Family)?\s*[<(]/],
  ['query', /\buse(?:Suspense)?(?:Infinite)?(?:Query|Queries|Mutation)\s*[<(]|\buseSWR(?:Mutation|Infinite)?\s*[<(]/],
  ['fetch', /\bfetch\s*\(|\baxios[.(]|\bky\s*[.(]/],
  ['form', /\buseForm\s*[<(]|\buseActionState\s*\(/],
];

function parseExports(code) {
  const names = [];
  const add = (n, isDefault) => {
    if (n && !names.some((x) => x.replace(/\(d\)$/, '') === n)) names.push(isDefault ? `${n}(d)` : n);
  };
  for (const m of code.matchAll(/^export\s+(default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm)) add(m[2], !!m[1]);
  for (const m of code.matchAll(/^export\s+(default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) add(m[2], !!m[1]);
  for (const m of code.matchAll(/^export\s+(?:const|let|var|enum)\s+([A-Za-z_$][\w$]*)/gm)) add(m[1], false);
  for (const m of code.matchAll(/^export\s+default\s+(?:memo\(|forwardRef\(|observer\()?([A-Za-z_$][\w$]*)\)?\s*;?\s*$/gm)) {
    if (!['function', 'class', 'async'].includes(m[1])) add(m[1], true);
  }
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const p = part.trim();
      if (!p || p.startsWith('type ')) continue;
      const [local, exported] = p.split(/\s+as\s+/);
      if (exported === 'default') add(local, true);
      else add(exported ?? local, false);
    }
  }
  if (/^export\s+default\s+(?:async\s+)?(?:function\s*\(|\(|class\s*\{)/m.test(code)) add('anonymous', true);
  if (/^export\s+\*\s+from/m.test(code)) names.push('*');
  return names;
}

const info = new Map();
const fanIn = new Map();
const routerHits = [];
for (const rel of sources) {
  const code = readFileSync(join(root, rel), 'utf8');
  const lines = code.split('\n').length;
  const tags = TAGS.filter(([, re]) => re.test(code)).map(([t]) => t);
  const imports = new Set();
  for (const m of code.matchAll(IMPORT_RE)) {
    const target = resolveImport(rel, m[1] ?? m[2]);
    if (target && target !== rel) imports.add(target);
  }
  for (const t of imports) fanIn.set(t, (fanIn.get(t) ?? 0) + 1);
  info.set(rel, { lines, tags, exports: parseExports(code) });

  // Library-mode react-router routes (file-based routers are derived from paths below)
  if (/createBrowserRouter|createHashRouter|createMemoryRouter|<Route\b|useRoutes\s*\(/.test(code)) {
    code.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/<Route\b[^>]*?\bpath=["'{]["']?([^"'}]*)|\bpath:\s*['"]([^'"]*)['"]/g)) {
        routerHits.push([m[1] ?? m[2], `${rel}:${i + 1}`]);
      }
    });
  }
}

// Colocated test detection: Foo.test.tsx, __tests__/Foo.test.tsx, Foo.spec.ts
const testKeys = new Set(
  tests.map((t) => t.replace(/\/__tests__\//, '/').replace(/^__tests__\//, '').replace(/\.(test|spec)\.[jt]sx?$/, '')),
);
const hasTest = (rel) => testKeys.has(rel.replace(/\.[^.]+$/, '')) || testKeys.has(rel.replace(/\/index\.[^.]+$/, ''));

// --- File-based routes ---
let pkg = {};
try {
  pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
} catch {
  // Keep going with no dependency info
}
const deps = { ...pkg.devDependencies, ...pkg.dependencies };
const routes = [];
const ROUTE_FILE_EXT = /\.(tsx|ts|jsx|js)$/;

if (deps.next) {
  for (const rel of sources) {
    const app = rel.match(/^(?:src\/)?app\/(.*?)(page|route)\.(?:tsx|ts|jsx|js)$/);
    if (app) {
      const segs = app[1].split('/').filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@'));
      routes.push([`${app[2] === 'route' ? 'API ' : ''}/${segs.join('/')}`, rel]);
      continue;
    }
    const pages = rel.match(/^(?:src\/)?pages\/(.*)$/);
    if (pages && !/^_(app|document|error)\./.test(pages[1])) {
      const path = pages[1].replace(ROUTE_FILE_EXT, '').replace(/(^|\/)index$/, '');
      routes.push([`${path.startsWith('api/') || path === 'api' ? 'API ' : ''}/${path}`, rel]);
    }
  }
} else if (deps['expo-router']) {
  for (const rel of sources) {
    const m = rel.match(/^(?:src\/)?app\/(.*)$/);
    if (!m || /(^|\/)_layout\./.test(m[1]) || /\+(html|not-found)\./.test(m[1])) continue;
    const segs = m[1].replace(ROUTE_FILE_EXT, '').split('/').filter((s) => !/^\(.*\)$/.test(s) && s !== 'index');
    routes.push([`/${segs.join('/')}`, rel]);
  }
} else if (Object.keys(deps).some((d) => d.startsWith('@remix-run/') || d === '@react-router/dev')) {
  for (const rel of sources) {
    const m = rel.match(/^app\/routes\/(.*)$/);
    if (!m) continue;
    const name = m[1].replace(/\/route\.[jt]sx?$/, '').replace(ROUTE_FILE_EXT, '');
    const segs = name
      .split('.')
      .filter((s) => s !== '_index' && !/^_[^_]/.test(s))
      .map((s) => s.replace(/_$/, '').replace(/^\$$/, '*').replace(/^\$/, ':').replace(/^\((.+)\)$/, '$1?'));
    routes.push([`/${segs.join('/')}`, rel]);
  }
}
for (const [path, loc] of routerHits) routes.push([path, loc]);

// --- Render ---
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const count = (tag) => [...info.values()].filter((f) => f.tags.includes(tag)).length;
const components = [...info.values()].filter((f) => f.exports.some((e) => /^[A-Z][a-z]/.test(e))).length;
const hooks = [...info.values()].filter((f) => f.exports.some((e) => /^use[A-Z]/.test(e))).length;
const untested = sources.filter((rel) => /\.(tsx|jsx)$/.test(rel) && !hasTest(rel)).length;

const out = [];
out.push(`<!-- react-map v1 · fingerprint: ${hash} · generated ${new Date().toISOString().slice(0, 16)}Z -->`);
out.push(`# Project map — ${pkg.name ?? posix.basename(root.replace(/\\/g, '/'))}`);
out.push('');
out.push(
  `${sources.length} source files · ${components} with components · ${hooks} with hooks · ${tests.length} tests · ${stories} stories · ${untested} .tsx/.jsx without a colocated test`,
);
out.push('Line format: `file LOC · exports · tags · ←N (imported by N files) · T (has test)`. `(d)` = default export, `*` = re-exports.');
out.push(`Tags: client, server, ctx (createContext), store, query (data hooks), fetch, form. Aliases: ${aliases.map(([a, t]) => `${a}→${t || './'}`).join(', ')}`);

if (routes.length) {
  out.push('', '## Routes');
  const width = Math.min(40, Math.max(...routes.map(([p]) => p.length)));
  for (const [path, loc] of routes.sort((a, b) => a[0].localeCompare(b[0]))) out.push(`${path.padEnd(width)}  ${loc}`);
}

const top = (list, n) => list.slice(0, n).map(([rel, v]) => `${rel} (${v})`).join(' · ');
out.push('', '## Hotspots');
out.push(`Most imported: ${top([...fanIn.entries()].sort((a, b) => b[1] - a[1]), 10) || '-'}`);
out.push(`Largest: ${top([...info.entries()].map(([r, f]) => [r, f.lines]).sort((a, b) => b[1] - a[1]), 10) || '-'}`);

out.push('', '## Files');
let currentDir = null;
for (const rel of sources) {
  const dir = posix.dirname(rel);
  if (dir !== currentDir) {
    out.push(`### ${dir === '.' ? './' : `${dir}/`}`);
    currentDir = dir;
  }
  const f = info.get(rel);
  const parts = [`${posix.basename(rel)} ${f.lines}`];
  if (f.exports.length) parts.push(f.exports.join(', '));
  if (f.tags.length) parts.push(f.tags.join(' '));
  const suffix = [fanIn.get(rel) ? `←${fanIn.get(rel)}` : '', hasTest(rel) ? 'T' : ''].filter(Boolean).join(' ');
  if (suffix) parts.push(suffix);
  out.push(parts.join(' · '));
}

const text = out.join('\n') + '\n';
if (flag('--stdout')) {
  process.stdout.write(text);
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text);
  const rel = relative(root, outFile).replace(/\\/g, '/');
  console.log(`wrote ${rel} — ${sources.length} files, ${routes.length} routes, ${kb(text.length)} (~${Math.round(text.length / 4 / 100) / 10}k tokens)`);
}
