#!/usr/bin/env node
// React project stack detector (zero dependencies)
// Usage: node detect-stack.mjs [projectDir] [--json]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const startDir = resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());

function findUp(file, from) {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, file))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const root = findUp('package.json', startDir);
if (!root) {
  const msg = `package.json not found from: ${startDir}`;
  if (asJson) console.log(JSON.stringify({ error: msg }));
  else console.error(msg);
  process.exit(1);
}

const pkg = readJson(join(root, 'package.json')) ?? {};
const deps = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies };
const has = (name) => Object.prototype.hasOwnProperty.call(deps, name);
const hasPrefix = (prefix) => Object.keys(deps).some((d) => d.startsWith(prefix));
const exists = (...p) => existsSync(join(root, ...p));
const version = (name) => (has(name) ? String(deps[name]).replace(/^[\^~>=<\s]+/, '') : null);
const major = (name) => {
  const v = version(name);
  const m = v && v.match(/^(\d+)/);
  return m ? Number(m[1]) : null;
};
const pick = (map) => Object.entries(map).filter(([, ok]) => ok).map(([k]) => k);

// --- Framework / bundler ---
let framework = 'unknown';
let routerMode = null;
if (has('next')) {
  framework = 'nextjs';
  const appDir = exists('app') || exists('src', 'app');
  const pagesDir = exists('pages') || exists('src', 'pages');
  routerMode = appDir && pagesDir ? 'app+pages' : appDir ? 'app' : pagesDir ? 'pages' : null;
} else if (hasPrefix('@remix-run/')) {
  framework = 'remix';
} else if (has('@react-router/dev')) {
  framework = 'react-router-framework';
} else if (has('@tanstack/react-start') || has('@tanstack/start')) {
  framework = 'tanstack-start';
} else if (has('gatsby')) {
  framework = 'gatsby';
} else if (has('astro')) {
  framework = 'astro';
} else if (has('expo')) {
  framework = 'expo';
} else if (has('react-native')) {
  framework = 'react-native';
} else if (has('vite')) {
  framework = 'vite';
} else if (has('react-scripts')) {
  framework = 'cra';
} else if (has('webpack')) {
  framework = 'webpack';
} else if (has('@rsbuild/core') || has('@rspack/core')) {
  framework = 'rspack';
} else if (has('parcel')) {
  framework = 'parcel';
}

// --- Source structure ---
const srcRoot = exists('src') ? 'src' : '.';
const listDirs = (dir) => {
  try {
    return readdirSync(join(root, dir)).filter((n) => {
      if (n.startsWith('.') || n === 'node_modules') return false;
      try {
        return statSync(join(root, dir, n)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};
const srcDirs = listDirs(srcRoot);
const fsdLayers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];
const architecture =
  fsdLayers.filter((l) => srcDirs.includes(l)).length >= 4
    ? 'feature-sliced-design'
    : srcDirs.includes('features') || srcDirs.includes('modules')
      ? 'feature-based'
      : srcDirs.includes('components')
        ? 'type-based'
        : 'unknown';

const componentsJson = readJson(join(root, 'components.json'));

const result = {
  root,
  name: pkg.name ?? null,
  packageManager: exists('pnpm-lock.yaml')
    ? 'pnpm'
    : exists('bun.lockb') || exists('bun.lock')
      ? 'bun'
      : exists('yarn.lock')
        ? 'yarn'
        : exists('package-lock.json')
          ? 'npm'
          : (pkg.packageManager?.split('@')[0] ?? 'unknown'),
  monorepo: pick({
    workspaces: Boolean(pkg.workspaces) || exists('pnpm-workspace.yaml'),
    turborepo: exists('turbo.json'),
    nx: exists('nx.json'),
    lerna: exists('lerna.json'),
  }),
  react: { version: version('react'), major: major('react'), compiler: has('babel-plugin-react-compiler') },
  typescript: has('typescript') || exists('tsconfig.json'),
  framework,
  frameworkVersion: version(
    { nextjs: 'next', vite: 'vite', cra: 'react-scripts', gatsby: 'gatsby', expo: 'expo', 'react-native': 'react-native' }[
      framework
    ] ?? '',
  ),
  routerMode,
  routing: pick({
    'react-router': has('react-router') || has('react-router-dom'),
    'tanstack-router': has('@tanstack/react-router'),
    wouter: has('wouter'),
  }),
  state: pick({
    'redux-toolkit': has('@reduxjs/toolkit'),
    redux: has('redux') && !has('@reduxjs/toolkit'),
    zustand: has('zustand'),
    jotai: has('jotai'),
    recoil: has('recoil'),
    mobx: has('mobx'),
    valtio: has('valtio'),
    xstate: has('xstate'),
  }),
  serverState: pick({
    'tanstack-query': has('@tanstack/react-query') || has('react-query'),
    swr: has('swr'),
    'rtk-query?': has('@reduxjs/toolkit'), // verify createApi usage in code
    apollo: has('@apollo/client'),
    urql: has('urql'),
    relay: has('react-relay'),
    trpc: hasPrefix('@trpc/'),
  }),
  styling: pick({
    tailwind: has('tailwindcss'),
    'styled-components': has('styled-components'),
    emotion: has('@emotion/react') || has('@emotion/styled'),
    sass: has('sass') || has('node-sass'),
    'vanilla-extract': has('@vanilla-extract/css'),
    stitches: has('@stitches/react'),
    panda: has('@pandacss/dev'),
  }),
  uiLibrary: pick({
    'shadcn-ui': Boolean(componentsJson),
    radix: hasPrefix('@radix-ui/'),
    mui: has('@mui/material'),
    chakra: has('@chakra-ui/react'),
    antd: has('antd'),
    mantine: has('@mantine/core'),
    'headless-ui': has('@headlessui/react'),
    'react-aria': has('react-aria') || has('react-aria-components'),
  }),
  forms: pick({
    'react-hook-form': has('react-hook-form'),
    formik: has('formik'),
    'tanstack-form': has('@tanstack/react-form'),
    zod: has('zod'),
    yup: has('yup'),
    valibot: has('valibot'),
  }),
  i18n: pick({
    'react-i18next': has('react-i18next'),
    'next-intl': has('next-intl'),
    'react-intl': has('react-intl'),
    lingui: hasPrefix('@lingui/'),
  }),
  testing: pick({
    vitest: has('vitest'),
    jest: has('jest') || has('react-scripts'),
    'testing-library': has('@testing-library/react'),
    'user-event': has('@testing-library/user-event'),
    msw: has('msw'),
    playwright: has('@playwright/test'),
    cypress: has('cypress'),
    storybook: hasPrefix('@storybook/') || has('storybook'),
  }),
  quality: pick({
    eslint: has('eslint'),
    'eslint-plugin-react-hooks': has('eslint-plugin-react-hooks'),
    'eslint-plugin-jsx-a11y': has('eslint-plugin-jsx-a11y'),
    biome: has('@biomejs/biome'),
    oxlint: has('oxlint'),
    prettier: has('prettier'),
  }),
  configFiles: [
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'next.config.ts',
    'next.config.js',
    'next.config.mjs',
    'tailwind.config.ts',
    'tailwind.config.js',
    'vitest.config.ts',
    'jest.config.ts',
    'jest.config.js',
    'playwright.config.ts',
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc.json',
    '.eslintrc.cjs',
    'biome.json',
    'components.json',
    'CLAUDE.md',
  ].filter((f) => exists(f)),
  scripts: pkg.scripts ?? {},
  structure: {
    srcRoot,
    topLevelDirs: srcDirs,
    architecture,
    pathAlias: (() => {
      const ts = readJson(join(root, 'tsconfig.json'));
      const paths = ts?.compilerOptions?.paths;
      return paths ? Object.keys(paths) : [];
    })(),
  },
};

// CSS Modules: detected by file presence (shallow walk)
const hasCssModules = (() => {
  const stack = [join(root, srcRoot)];
  let visited = 0;
  while (stack.length && visited < 400) {
    const dir = stack.pop();
    visited++;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      if (e.isDirectory()) stack.push(join(dir, e.name));
      else if (/\.module\.(css|scss|sass|less)$/.test(e.name)) return true;
    }
  }
  return false;
})();
if (hasCssModules) result.styling.push('css-modules');

const cmd = (script) => {
  if (!result.scripts[script]) return null;
  const pm = result.packageManager === 'unknown' ? 'npm' : result.packageManager;
  return pm === 'npm' || pm === 'bun' ? `${pm} run ${script}` : `${pm} ${script}`;
};
result.commands = {
  dev: cmd('dev') ?? cmd('start'),
  build: cmd('build'),
  test: cmd('test'),
  lint: cmd('lint'),
  typecheck: cmd('typecheck') ?? cmd('type-check') ?? cmd('tsc'),
  e2e: cmd('e2e') ?? cmd('test:e2e'),
  storybook: cmd('storybook'),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const list = (a) => (a.length ? a.join(', ') : '-');
  const lines = [
    `# React Stack: ${result.name ?? '(unnamed)'}`,
    `root            ${result.root}`,
    `package manager ${result.packageManager}${result.monorepo.length ? ` (monorepo: ${list(result.monorepo)})` : ''}`,
    `react           ${result.react.version ?? '-'}${result.react.compiler ? ' + React Compiler' : ''}`,
    `typescript      ${result.typescript ? 'yes' : 'no'}`,
    `framework       ${result.framework}${result.frameworkVersion ? ` ${result.frameworkVersion}` : ''}${result.routerMode ? ` (${result.routerMode} router)` : ''}`,
    `routing         ${list(result.routing)}`,
    `client state    ${list(result.state)}`,
    `server state    ${list(result.serverState)}`,
    `styling         ${list(result.styling)}`,
    `ui library      ${list(result.uiLibrary)}`,
    `forms/schema    ${list(result.forms)}`,
    `i18n            ${list(result.i18n)}`,
    `testing         ${list(result.testing)}`,
    `quality         ${list(result.quality)}`,
    `structure       ${result.structure.srcRoot}/ [${list(result.structure.topLevelDirs)}] -> ${result.structure.architecture}`,
    `path alias      ${list(result.structure.pathAlias)}`,
    `config files    ${list(result.configFiles)}`,
    `commands        ${Object.entries(result.commands)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=\`${v}\``)
      .join('  ') || '-'}`,
  ];
  console.log(lines.join('\n'));
}
