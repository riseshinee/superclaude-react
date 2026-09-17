#!/usr/bin/env node
// Convert publisher HTML into JSX (zero dependencies).
//
// Usage:
//   node html-to-jsx.mjs <file.html|-> [options]
//
// Options:
//   --select <sel>       Convert only the first match: tag, #id, .class, tag.class (default: <body> contents)
//   --outer              With --select, include the matched element itself (default: true); --inner for children only
//   --inner              With --select, convert only the matched element's children
//   --component <Name>   Wrap output in `export function Name() { return (...) }`
//   --asset-base <url>   Rewrite relative asset paths to absolute URLs under this base (e.g. /publish)
//   --root <dir>         Publisher root that --asset-base maps to (default: the HTML file's directory)
//   --out <file>         Write to file instead of stdout (refuses to overwrite without --force)
//   --ts                 TypeScript output (casts styles with CSS custom properties); implied by --out *.tsx
//   --force              Allow overwriting --out
//   --json               Print { jsx, notes } as JSON
//   --quiet              Don't print conversion notes to stderr
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve, sep, posix } from 'node:path';
import { parseHtml, querySelector, getAttr, VOID_TAGS } from './lib/html.mjs';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const opts = { select: null, inner: false, component: null, assetBase: null, root: null, out: null, ts: false, force: false, json: false, quiet: false };
let input = null;
for (let k = 0; k < argv.length; k++) {
  const a = argv[k];
  const next = () => {
    const v = argv[++k];
    if (v === undefined) fail(`Missing value for ${a}`);
    return v;
  };
  if (a === '--select') opts.select = next();
  else if (a === '--inner') opts.inner = true;
  else if (a === '--outer') opts.inner = false;
  else if (a === '--component') opts.component = next();
  else if (a === '--asset-base') opts.assetBase = next().replace(/\/+$/, '');
  else if (a === '--root') opts.root = next();
  else if (a === '--out') opts.out = next();
  else if (a === '--ts') opts.ts = true;
  else if (a === '--force') opts.force = true;
  else if (a === '--json') opts.json = true;
  else if (a === '--quiet') opts.quiet = true;
  else if (a === '-h' || a === '--help') {
    const lines = readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/).slice(1);
    const header = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
    console.log(header.map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
  } else if (a.startsWith('--')) fail(`Unknown option: ${a}`);
  else input = a;
}
if (opts.out && /\.tsx$/.test(opts.out)) opts.ts = true;
if (!input) fail('Usage: node html-to-jsx.mjs <file.html|-> [--select sel] [--component Name] [--asset-base /publish]');
if (opts.component && !/^[A-Z][A-Za-z0-9]*$/.test(opts.component)) fail('--component must be PascalCase');
if (opts.assetBase && /^[A-Za-z]:[\\/]/.test(opts.assetBase)) {
  fail(
    `--asset-base became a Windows path (${opts.assetBase}). Git Bash/MSYS rewrites arguments starting with "/".\n` +
      'Re-run with MSYS_NO_PATHCONV=1, e.g.: MSYS_NO_PATHCONV=1 node html-to-jsx.mjs page.html --asset-base /publish',
  );
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const html = input === '-' ? readFileSync(0, 'utf8') : readFileSync(input, 'utf8');
const htmlDir = input === '-' ? process.cwd() : dirname(resolve(input));
const publishRoot = resolve(opts.root ?? htmlDir);

// ---------- Notes ----------
const notes = { handlers: [], scripts: [], styles: [], assets: new Set(), pageLinks: new Set(), a11y: [], forms: [], head: [] };

// ---------- Attribute mapping ----------
const ATTR_MAP = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
  minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan', cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing', contenteditable: 'contentEditable', crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete', autofocus: 'autoFocus', autoplay: 'autoPlay', enctype: 'encType',
  accesskey: 'accessKey', novalidate: 'noValidate', frameborder: 'frameBorder', allowfullscreen: 'allowFullScreen',
  srcset: 'srcSet', datetime: 'dateTime', usemap: 'useMap', inputmode: 'inputMode', spellcheck: 'spellCheck',
  formaction: 'formAction', formmethod: 'formMethod', formtarget: 'formTarget', playsinline: 'playsInline',
  charset: 'charSet', 'http-equiv': 'httpEquiv', enterkeyhint: 'enterKeyHint', referrerpolicy: 'referrerPolicy',
  srcdoc: 'srcDoc', srclang: 'srcLang', hreflang: 'hrefLang', marginwidth: 'marginWidth',
  marginheight: 'marginHeight', fetchpriority: 'fetchPriority', popovertarget: 'popoverTarget',
};
// React DOM types declare these as number — emit {20} instead of "20"
const NUMERIC_PROPS = new Set(['maxLength', 'minLength', 'tabIndex', 'colSpan', 'rowSpan', 'rows', 'cols', 'size', 'span', 'start']);
const INPUT_VALUE_KEEP = new Set(['checkbox', 'radio', 'submit', 'button', 'reset', 'hidden', 'image']);
const ASSET_ATTRS = new Set(['src', 'poster', 'data-src', 'data-original', 'data-bg', 'data-background']);

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const clip = (s, len = 80) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > len ? `${one.slice(0, len)}…` : one;
};
const isExternal = (url) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/|\{)/i.test(url);

function rewriteAsset(url) {
  if (!url || isExternal(url)) return url;
  const [path, suffix = ''] = url.split(/(?=[?#])/);
  notes.assets.add(path);
  if (!opts.assetBase) return url;
  const abs = resolve(htmlDir, path);
  const rel = relative(publishRoot, abs).split(sep).join(posix.sep);
  if (rel.startsWith('..')) return url; // outside publisher root: leave as-is
  return `${opts.assetBase}/${rel}${suffix}`;
}

function rewriteSrcset(value) {
  return value
    .split(',')
    .map((part) => {
      const [url, ...desc] = part.trim().split(/\s+/);
      return [rewriteAsset(url), ...desc].join(' ');
    })
    .join(', ');
}

function styleToObject(css) {
  const decls = [];
  let buf = '';
  let depth = 0;
  let quote = null;
  for (const ch of css) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ';' && depth === 0) {
      decls.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  decls.push(buf);
  const entries = [];
  for (const decl of decls) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const rawKey = decl.slice(0, idx).trim();
    let value = decl.slice(idx + 1).trim();
    if (!rawKey || !value) continue;
    value = value.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (_, q, u) => `url(${q}${rewriteAsset(u)}${q})`);
    let key;
    if (rawKey.startsWith('--')) key = JSON.stringify(rawKey);
    else {
      const lower = rawKey.toLowerCase();
      key = lower.startsWith('-ms-') ? camel(lower.slice(1)) : lower.startsWith('-') ? camel(lower.slice(1)).replace(/^./, (c) => c.toUpperCase()) : camel(lower);
    }
    entries.push(`${key}: ${JSON.stringify(value)}`);
  }
  if (!entries.length) return null;
  const hasCustomProps = entries.some((e) => e.startsWith('"--'));
  return opts.ts && hasCustomProps ? `{{ ${entries.join(', ')} } as React.CSSProperties}` : `{{ ${entries.join(', ')} }}`;
}

function attrValue(v) {
  return v.includes('"') ? `{${JSON.stringify(v)}}` : `"${v}"`;
}

function convertAttrs(el, ctx) {
  const out = [];
  const tag = el.tag;
  const type = (getAttr(el, 'type') ?? '').toLowerCase();
  for (const { name, value } of el.attrs) {
    const lower = name.toLowerCase();

    if (/^on[a-z]+$/.test(lower)) {
      notes.handlers.push(`<${tag}${getAttr(el, 'id') ? `#${getAttr(el, 'id')}` : ''}> ${lower}="${clip(value ?? '')}"`);
      out.push(`/* TODO(markup): ${lower}="${clip(value ?? '', 60).replace(/\*\//g, '* /')}" */`);
      continue;
    }
    if (lower === 'style') {
      const obj = value ? styleToObject(value) : null;
      if (obj) out.push(`style=${obj}`);
      continue;
    }
    if (tag === 'option' && lower === 'selected') continue; // lifted to <select defaultValue>
    if (tag === 'textarea' && lower === 'value') continue;

    let jsxName;
    if (lower.startsWith('data-') || lower.startsWith('aria-')) jsxName = lower;
    else if (ctx.inSvg && name.includes(':')) jsxName = camel(name.replace(':', '-').toLowerCase());
    else if (ctx.inSvg && name.includes('-')) jsxName = camel(lower);
    else if (ATTR_MAP[lower]) jsxName = ATTR_MAP[lower];
    else jsxName = ctx.inSvg ? name : lower;

    if (tag === 'input' && lower === 'checked') jsxName = 'defaultChecked';
    if (tag === 'input' && lower === 'value' && !INPUT_VALUE_KEEP.has(type)) jsxName = 'defaultValue';

    let v = value;
    if (v != null) {
      if (lower === 'class') {
        v = v.split(/\s+/).filter(Boolean).join(' ');
        if (!v) continue;
      }
      if (NUMERIC_PROPS.has(jsxName) && /^-?\d+$/.test(v.trim())) {
        out.push(`${jsxName}={${v.trim()}}`);
        continue;
      }
      if (ASSET_ATTRS.has(lower) || (lower === 'href' && ['link', 'use', 'image'].includes(tag))) v = rewriteAsset(v);
      if (lower === 'srcset') v = rewriteSrcset(v);
      if (lower === 'href' && tag === 'a') {
        if (/^javascript:/i.test(v) || v === '#') notes.a11y.push(`<a href="${clip(v, 40)}"> "${clip(textOf(el), 30)}" — use <button> for actions`);
        else if (/\.html?(?:[?#]|$)/i.test(v) && !isExternalHttp(v)) notes.pageLinks.add(v);
        else if (!isExternal(v) && /\.(?:pdf|zip|hwp|docx?|xlsx?|pptx?)$/i.test(v)) v = rewriteAsset(v);
      }
    }
    out.push(v == null ? jsxName : `${jsxName}=${attrValue(v)}`);
  }

  if (tag === 'img' && getAttr(el, 'alt') === undefined) notes.a11y.push(`<img src="${clip(getAttr(el, 'src') ?? '', 50)}"> missing alt`);
  if (tag === 'select') {
    const selected = findSelectedOption(el);
    if (selected.length > 1 || getAttr(el, 'multiple') !== undefined) {
      if (selected.length) out.push(`defaultValue={${JSON.stringify(selected)}}`);
    } else if (selected.length === 1) out.push(`defaultValue=${attrValue(selected[0])}`);
  }
  if (tag === 'textarea') {
    const text = el.children.map((c) => c.value ?? '').join('');
    if (text.trim()) out.push(`defaultValue={${JSON.stringify(text)}}`);
  }
  if (tag === 'form') notes.forms.push(`<form${getAttr(el, 'action') ? ` action="${getAttr(el, 'action')}"` : ''}${getAttr(el, 'id') ? ` id="${getAttr(el, 'id')}"` : ''}>`);
  return out;
}

const isExternalHttp = (url) => /^(?:https?:)?\/\//i.test(url);

function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join(' ').replace(/\s+/g, ' ').trim();
}

// <table><tr> is invalid DOM nesting for React — wrap direct <tr> runs in <tbody>
function fixTables(node) {
  for (const c of node.children ?? []) if (c.type === 'element') fixTables(c);
  if (node.tag !== 'table') return;
  const kids = [];
  let tbody = null;
  for (const c of node.children) {
    if (c.type === 'element' && c.tag === 'tr') {
      if (!tbody) {
        tbody = { type: 'element', name: 'tbody', tag: 'tbody', attrs: [], children: [], parent: node };
        kids.push(tbody);
      }
      tbody.children.push(c);
      c.parent = tbody;
    } else {
      if (!(c.type === 'text' && !c.value.trim())) tbody = null;
      kids.push(c);
    }
  }
  node.children = kids;
}

function findSelectedOption(select) {
  const values = [];
  const visit = (node) => {
    for (const c of node.children ?? []) {
      if (c.type !== 'element') continue;
      if (c.tag === 'option' && getAttr(c, 'selected') !== undefined) values.push(getAttr(c, 'value') ?? textOf(c).trim());
      visit(c);
    }
  };
  visit(select);
  return values;
}

// ---------- JSX serialization ----------
const INDENT = '  ';
const escapeText = (s) => s.replace(/[{}]/g, (c) => `{'${c}'}`).replace(/>/g, '&gt;');
const commentJsx = (s) => `{/* ${clip(s, 200).replace(/\*\//g, '* /')} */}`;
const isBlankText = (n) => n.type === 'text' && !n.value.trim();
const hasText = (el) => el.children.some((c) => c.type === 'text' && c.value.trim());

const noted = new WeakSet();
function skipNode(node) {
  if (node.type === 'comment') return /^\s*\[if |^\s*<!\[endif\]/i.test(node.value);
  if (node.type !== 'element') return false;
  if (!['script', 'style', 'noscript'].includes(node.tag)) return false;
  if (noted.has(node)) return true;
  noted.add(node);
  if (node.tag === 'script') {
    const src = getAttr(node, 'src');
    const type = getAttr(node, 'type');
    notes.scripts.push(src ? `src="${src}"` : `inline${type ? ` (${type})` : ''}: ${clip(textOf(node), 100)}`);
    return true;
  }
  if (node.tag === 'style') {
    notes.styles.push(clip(textOf(node), 100));
    return true;
  }
  if (node.tag === 'noscript') return true;
  return false;
}

function childCtx(el, ctx) {
  return { inSvg: ctx.inSvg || el.tag === 'svg', inPre: ctx.inPre || el.tag === 'pre' };
}

function tagName(el, ctx) {
  return ctx.inSvg || el.tag === 'svg' ? el.name : el.tag;
}

function openTag(el, ctx, selfClose) {
  const attrs = convertAttrs(el, { inSvg: ctx.inSvg || el.tag === 'svg' });
  const name = tagName(el, ctx);
  return `<${name}${attrs.length ? ` ${attrs.join(' ')}` : ''}${selfClose ? ' />' : '>'}`;
}

function inline(node, ctx) {
  if (node.type === 'comment') return commentJsx(node.value);
  if (node.type === 'text') {
    if (ctx.inPre) return `{${JSON.stringify(node.value)}}`;
    return escapeText(node.value.replace(/\s+/g, ' '));
  }
  if (skipNode(node)) return '';
  const kids = node.tag === 'textarea' ? [] : node.children.filter((c) => !skipNode(c));
  if (VOID_TAGS.has(node.tag) || kids.length === 0) return openTag(node, ctx, true);
  const cctx = childCtx(node, ctx);
  let inner = kids.map((c) => inline(c, cctx)).join('');
  if (!cctx.inPre) inner = inner.replace(/^ +| +$/g, '');
  return `${openTag(node, ctx, false)}${inner}</${tagName(node, ctx)}>`;
}

function block(node, depth, ctx) {
  const pad = INDENT.repeat(depth);
  if (node.type === 'comment') return [pad + commentJsx(node.value)];
  if (node.type === 'text') {
    const t = node.value.replace(/\s+/g, ' ').trim();
    return t ? [pad + escapeText(t)] : [];
  }
  if (skipNode(node)) return [];
  const kids = node.tag === 'textarea' ? [] : node.children.filter((c) => !isBlankText(c) && !skipNode(c));
  if (VOID_TAGS.has(node.tag) || kids.length === 0) return [pad + openTag(node, ctx, true)];
  if (hasText(node) || node.tag === 'pre') return [pad + inline(node, ctx)];
  const cctx = childCtx(node, ctx);
  return [
    pad + openTag(node, ctx, false),
    ...kids.flatMap((c) => block(c, depth + 1, cctx)),
    `${pad}</${tagName(node, ctx)}>`,
  ];
}

// ---------- Main ----------
const doc = parseHtml(html);
fixTables(doc);
let nodes;
if (opts.select) {
  let match;
  try {
    match = querySelector(doc, opts.select);
  } catch (e) {
    fail(e.message);
  }
  if (!match) fail(`No element matches "${opts.select}"`);
  nodes = opts.inner ? match.children : [match];
} else {
  const body = querySelector(doc, 'body');
  nodes = body ? body.children : doc.children.filter((c) => !(c.type === 'element' && c.tag === 'html'));
  const head = querySelector(doc, 'head');
  if (head) {
    for (const el of head.children) {
      if (el.type !== 'element') continue;
      if (el.tag === 'link' && /stylesheet/i.test(getAttr(el, 'rel') ?? '')) notes.head.push(`stylesheet ${getAttr(el, 'href')}`);
      else if (el.tag === 'title') notes.head.push(`title "${clip(textOf(el), 60)}"`);
      else if (el.tag === 'script' || el.tag === 'style') skipNode(el);
    }
  }
}

let rootCtx = { inSvg: false, inPre: false };
for (let p = nodes[0]?.parent; p && p.type === 'element'; p = p.parent) {
  if (p.tag === 'svg') rootCtx.inSvg = true;
  if (p.tag === 'pre') rootCtx.inPre = true;
}

const meaningful = nodes.filter((c) => !isBlankText(c) && !skipNode(c));
const baseDepth = opts.component ? 2 : 0;
let lines;
if (meaningful.length === 1 && meaningful[0].type === 'element') {
  lines = block(meaningful[0], baseDepth, rootCtx);
} else {
  const pad = INDENT.repeat(baseDepth);
  lines = [`${pad}<>`, ...meaningful.flatMap((c) => block(c, baseDepth + 1, rootCtx)), `${pad}</>`];
}

let jsx = lines.join('\n');
if (opts.component) {
  jsx = `export function ${opts.component}() {\n${INDENT}return (\n${jsx}\n${INDENT});\n}\n`;
} else {
  jsx += '\n';
}

const noteSections = [
  ['Inline event handlers → re-implement with React state/handlers', notes.handlers],
  ['Scripts removed → port behavior (see references/jquery-to-react.md)', notes.scripts],
  ['Inline <style> removed → move into the publisher CSS', notes.styles],
  ['Head (load globally in the app shell)', notes.head],
  ['Links to .html pages → map to routes (<Link>)', [...notes.pageLinks]],
  ['Forms → wire submit/validation', notes.forms],
  ['Accessibility', notes.a11y],
  [`Asset references${opts.assetBase ? ` (rewritten under ${opts.assetBase})` : ''}`, [...notes.assets]],
];

if (opts.json) {
  const obj = { jsx, notes: Object.fromEntries(noteSections.map(([title, items]) => [title, items])) };
  const text = JSON.stringify(obj, null, 2);
  if (opts.out) writeOut(text);
  else console.log(text);
} else {
  if (opts.out) writeOut(jsx);
  else process.stdout.write(jsx);
  if (!opts.quiet) {
    const report = noteSections
      .filter(([, items]) => items.length)
      .map(([title, items]) => `## ${title} (${items.length})\n${[...new Set(items)].slice(0, 30).map((x) => `- ${x}`).join('\n')}`)
      .join('\n\n');
    if (report) console.error(`\n# Conversion notes\n\n${report}\n`);
  }
}

function writeOut(text) {
  if (existsSync(opts.out) && !opts.force) fail(`Refusing to overwrite ${opts.out} (use --force)`);
  mkdirSync(dirname(resolve(opts.out)), { recursive: true });
  writeFileSync(opts.out, text);
  if (!opts.quiet) console.error(`wrote ${opts.out}`);
}
