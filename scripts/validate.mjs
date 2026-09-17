#!/usr/bin/env node
// Validates skills/ and agents/ structure. Run before committing: node scripts/validate.mjs
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function frontmatter(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

// Backticked react-* names that are libraries or migration keys, not skills/agents
const NOT_SKILL_NAMES = new Set(['react-19', 'react-window', 'react-codemod', 'react-error-boundary', 'react-test-renderer']);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Hangul, kana, CJK ideographs — shipped content must be English
const NON_ENGLISH_RE = /[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힯]/;

// Skills
const skillsDir = join(root, 'skills');
const skillNames = readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory());
for (const name of skillNames) {
  const file = `skills/${name}/SKILL.md`;
  const abs = join(root, file);
  if (!existsSync(abs)) {
    err(file, 'missing');
    continue;
  }
  const fm = frontmatter(abs);
  if (!fm) {
    err(file, 'missing YAML frontmatter');
    continue;
  }
  if (fm.data.name !== name) err(file, `name "${fm.data.name}" must equal folder name "${name}"`);
  if (!NAME_RE.test(name) || name.length > 64) err(file, 'name must be kebab-case, max 64 chars');
  if (!fm.data.description) err(file, 'description is required');
  else if (fm.data.description.length > 1024) err(file, 'description exceeds 1024 chars');
  if (fm.body.split('\n').length > 500) err(file, 'body exceeds 500 lines — move details to references/');

  // Referenced local files must exist
  for (const ref of fm.body.matchAll(/`((?:references|templates|scripts)\/[^`\s]+)`/g)) {
    if (!existsSync(join(skillsDir, name, ref[1]))) err(file, `referenced file not found: ${ref[1]}`);
  }
  // Referenced skills/agents must exist
  for (const ref of fm.body.matchAll(/`(react-[a-z0-9-]+)`/g)) {
    const r = ref[1];
    if (NOT_SKILL_NAMES.has(r)) continue;
    if (!skillNames.includes(r) && !existsSync(join(root, 'agents', `${r}.md`))) err(file, `unknown skill/agent reference: ${r}`);
  }
}

// Templates must not be picked up by host test runners / type checkers
for (const name of skillNames) {
  const tdir = join(skillsDir, name, 'templates');
  if (!existsSync(tdir)) continue;
  for (const f of readdirSync(tdir)) {
    if (!f.endsWith('.tpl')) err(`skills/${name}/templates/${f}`, 'template files must end with .tpl');
  }
}

// Agents
const agentsDir = join(root, 'agents');
for (const f of readdirSync(agentsDir).filter((n) => n.endsWith('.md'))) {
  const file = `agents/${f}`;
  const fm = frontmatter(join(root, file));
  if (!fm) {
    err(file, 'missing YAML frontmatter');
    continue;
  }
  const base = f.replace(/\.md$/, '');
  if (fm.data.name !== base) err(file, `name "${fm.data.name}" must equal file name "${base}"`);
  if (!fm.data.description) err(file, 'description is required');
}

// Shipped content should be English (READMEs in other languages are allowed at repo root)
for (const dir of ['skills', 'agents', 'mcp']) {
  const stack = [join(root, dir)];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (/\.(md|mjs|js|json|tpl)$/.test(e.name)) {
        const lines = readFileSync(p, 'utf8').split('\n');
        const idx = lines.findIndex((l) => NON_ENGLISH_RE.test(l));
        if (idx !== -1) err(p.slice(root.length + 1).replace(/\\/g, '/'), `non-English character on line ${idx + 1}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${skillNames.length} skills and ${readdirSync(agentsDir).filter((n) => n.endsWith(".md")).length} agents are valid`);
