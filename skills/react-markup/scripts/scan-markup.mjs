#!/usr/bin/env node
// Inventory a publisher's static deliverable before converting it to React (zero dependencies).
//
// Usage: node scan-markup.mjs <publishDir> [--json]
//
// Reports: pages, CSS/JS/assets, jQuery & plugin usage, blocks shared across pages (layout candidates),
// repeated sibling structures (list/card component candidates), CSS breakpoints, broken local references.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { parseHtml, walk, getAttr, classList, serializeHtml, textContent } from './lib/html.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const dirArg = args.find((a) => !a.startsWith('--'));
if (!dirArg) {
  console.error('Usage: node scan-markup.mjs <publishDir> [--json]');
  process.exit(1);
}
const root = resolve(dirArg);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`Not a directory: ${root}`);
  process.exit(1);
}

const rel = (p) => relative(root, p).split(sep).join('/');
const kb = (bytes) => `${Math.round(bytes / 102.4) / 10} KB`;

// ---------- Collect files ----------
const files = { html: [], css: [], js: [], images: [], fonts: [], media: [], other: [] };
const EXT = {
  html: ['.html', '.htm'],
  css: ['.css'],
  js: ['.js'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.bmp'],
  fonts: ['.woff', '.woff2', '.ttf', '.otf', '.eot'],
  media: ['.mp4', '.webm', '.mp3', '.json', '.lottie'],
};
(function collect(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) collect(p);
    else {
      const ext = extname(e.name).toLowerCase();
      const kind = Object.keys(EXT).find((k) => EXT[k].includes(ext)) ?? 'other';
      files[kind].push(p);
    }
  }
})(root);

// ---------- Library detection ----------
const LIBS = [
  ['jquery', /jquery(?![-.]?ui)(?:[-.]\d[\w.]*)?(?:\.min)?\.js$|\bjQuery\.fn\.jquery\b/i],
  ['jquery-ui', /jquery[-.]?ui/i],
  ['swiper', /swiper/i],
  ['slick', /slick/i],
  ['bxslider', /bxslider/i],
  ['owl-carousel', /owl\.carousel/i],
  ['gsap', /gsap|TweenMax|ScrollTrigger/i],
  ['aos', /(?:^|[\/.-])aos(?:[.-]|$)/i],
  ['fullpage', /fullpage/i],
  ['select2', /select2/i],
  ['datepicker', /datepicker|flatpickr|daterangepicker/i],
  ['lightbox', /fancybox|magnific|lightbox|colorbox/i],
  ['lottie', /lottie|bodymovin/i],
  ['bootstrap', /bootstrap(?:\.bundle)?(?:\.min)?\.js$/i],
  ['scroll-libs', /scrollmagic|locomotive|lenis|skrollr/i],
  ['layout-libs', /isotope|masonry|packery/i],
  ['chart', /chart(?:\.umd)?(?:\.min)?\.js$|highcharts|echarts/i],
];
const VENDOR_RE = /\.min\.js$|vendor|plugin|lib[s]?[\/\\]/i;

const libsFound = new Map(); // name -> Set(source)
const noteLib = (name, source) => {
  if (!libsFound.has(name)) libsFound.set(name, new Set());
  libsFound.get(name).add(source);
};

const JS_PATTERNS = [
  ['jQuery selectors $(…)', /(?:\$|jQuery)\(\s*['"`.#\w]/g],
  ['class toggling (add/remove/toggleClass)', /\.(?:addClass|removeClass|toggleClass)\(/g],
  ['event binding (.on/.click/addEventListener)', /\.(?:on|click|change|submit|hover|keyup|keydown)\(|addEventListener\(/g],
  ['jQuery effects (slide/fade/animate)', /\.(?:slideToggle|slideUp|slideDown|fadeIn|fadeOut|fadeToggle|animate|show|hide)\(/g],
  ['DOM building (html/append/innerHTML)', /\.(?:html|append|prepend|after|before)\(|innerHTML\s*=/g],
  ['AJAX ($.ajax/$.get/fetch)', /\$\.(?:ajax|get|post|getJSON)\(|\bfetch\(/g],
  ['scroll/resize handlers', /['"](?:scroll|resize)['"]|\.(?:scroll|resize)\(/g],
  ['timers (setInterval/setTimeout)', /\b(?:setInterval|setTimeout)\(/g],
];
const jsStats = Object.fromEntries(JS_PATTERNS.map(([k]) => [k, 0]));
const customJs = [];
const vendorJs = [];

function analyzeJs(source, label) {
  for (const [name, re] of LIBS) if (re.test(label)) noteLib(name, label);
  for (const [k, re] of JS_PATTERNS) jsStats[k] += (source.match(re) ?? []).length;
}

for (const f of files.js) {
  const label = rel(f);
  const isVendor = VENDOR_RE.test(label) || LIBS.some(([, re]) => re.test(label));
  if (isVendor) {
    vendorJs.push(label);
    for (const [name, re] of LIBS) if (re.test(label)) noteLib(name, label);
  } else {
    customJs.push({ file: label, size: statSync(f).size });
    analyzeJs(readFileSync(f, 'utf8'), label);
  }
}

// ---------- Pages ----------
const STATE_CLASSES = new Set(['on', 'active', 'current', 'is-active', 'selected', 'open', 'is-open', 'show', 'act']);
const LAYOUT_RE = /(?:^|[-_])(header|footer|gnb|lnb|snb|nav|navi|menu|sidebar|aside|quick|breadcrumb|location|topbar|util)(?:[-_]|$)/i;
const LAYOUT_TAGS = new Set(['header', 'footer', 'nav', 'aside']);

const pages = [];
const blockMap = new Map(); // key -> { strict: Map(hash -> Set(page)), normalized: Set(hash) }
const hashMarkup = (s) =>
  createHash('md5').update(s.replace(/\s+/g, ' ').replace(/> </g, '><')).digest('hex').slice(0, 8);
const repeatMap = new Map(); // signature -> { count, pages:Set }
const brokenRefs = new Map(); // ref -> Set(page)

function localRef(fromFile, url) {
  if (!url || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{)/i.test(url)) return null;
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  if (!clean) return null;
  return clean.startsWith('/') ? join(root, clean) : resolve(dirname(fromFile), clean);
}

function checkRef(fromFile, url) {
  const p = localRef(fromFile, url);
  if (p && !existsSync(p)) {
    const key = rel(p);
    if (!brokenRefs.has(key)) brokenRefs.set(key, new Set());
    brokenRefs.get(key).add(rel(fromFile));
  }
}

const signature = (el) => {
  const cls = classList(el).filter((c) => !STATE_CLASSES.has(c)).sort();
  return `${el.tag}${cls.length ? `.${cls.join('.')}` : ''}`;
};

for (const file of files.html) {
  const page = rel(file);
  const src = readFileSync(file, 'utf8');
  const doc = parseHtml(src);
  const info = { page, title: '', css: [], js: [], inlineScripts: 0, inlineHandlers: 0, forms: 0, images: 0, lines: src.split('\n').length };

  for (const el of walk(doc)) {
    if (el.type !== 'element') continue;
    for (const a of el.attrs) if (/^on[a-z]+$/i.test(a.name)) info.inlineHandlers++;
    switch (el.tag) {
      case 'title':
        info.title = textContent(el).trim();
        break;
      case 'link':
        if (/stylesheet/i.test(getAttr(el, 'rel') ?? '')) info.css.push(getAttr(el, 'href'));
        checkRef(file, getAttr(el, 'href'));
        break;
      case 'script': {
        const s = getAttr(el, 'src');
        if (s) {
          info.js.push(s);
          checkRef(file, s);
          for (const [name, re] of LIBS) if (re.test(s)) noteLib(name, s);
        } else {
          const code = textContent(el);
          if (code.trim()) {
            info.inlineScripts++;
            analyzeJs(code, `${page} (inline)`);
          }
        }
        break;
      }
      case 'form':
        info.forms++;
        break;
      case 'img':
        info.images++;
        checkRef(file, getAttr(el, 'src'));
        break;
      default:
        for (const attr of ['src', 'poster', 'data-src']) if (getAttr(el, attr)) checkRef(file, getAttr(el, attr));
    }
    const style = getAttr(el, 'style');
    if (style) for (const m of style.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) checkRef(file, m[1]);
  }

  // Layout candidates: outermost header/footer/nav-like blocks
  (function findBlocks(node) {
    for (const el of node.children ?? []) {
      if (el.type !== 'element') continue;
      const id = getAttr(el, 'id') ?? '';
      const cls = classList(el);
      const isLayout = LAYOUT_TAGS.has(el.tag) || LAYOUT_RE.test(id) || cls.some((c) => LAYOUT_RE.test(c));
      if (isLayout && el.tag !== 'body' && el.tag !== 'html') {
        const key = `${el.tag}${id ? `#${id}` : cls.length ? `.${cls.filter((c) => !STATE_CLASSES.has(c)).join('.')}` : ''}`;
        const strict = hashMarkup(serializeHtml(el));
        const normalized = hashMarkup(serializeHtml(el, { dropClasses: STATE_CLASSES }));
        if (!blockMap.has(key)) blockMap.set(key, { strict: new Map(), normalized: new Set() });
        const entry = blockMap.get(key);
        if (!entry.strict.has(strict)) entry.strict.set(strict, new Set());
        entry.strict.get(strict).add(page);
        entry.normalized.add(normalized);
        continue; // don't descend into a layout block
      }
      findBlocks(el);
    }
  })(doc);

  // Repeated sibling structures (3+ siblings with the same tag+classes and nested markup)
  for (const el of walk(doc)) {
    if (el.type !== 'element') continue;
    const groups = new Map();
    for (const c of el.children) {
      if (c.type !== 'element' || !c.children.some((k) => k.type === 'element')) continue;
      const sig = signature(c);
      groups.set(sig, (groups.get(sig) ?? 0) + 1);
    }
    for (const [sig, count] of groups) {
      if (count < 3) continue;
      const parentSig = signature(el);
      const full = `${parentSig} > ${sig}`;
      if (!repeatMap.has(full)) repeatMap.set(full, { max: 0, pages: new Set() });
      const entry = repeatMap.get(full);
      entry.max = Math.max(entry.max, count);
      entry.pages.add(page);
    }
  }

  pages.push(info);
}

// ---------- CSS ----------
const cssInfo = [];
const breakpoints = new Set();
for (const f of files.css) {
  const text = readFileSync(f, 'utf8');
  const imports = [...text.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)].map((m) => m[1]);
  const urls = [...text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
  for (const u of urls) checkRef(f, u);
  for (const u of imports) if (!/^https?:|^\/\//.test(u)) checkRef(f, u);
  for (const m of text.matchAll(/@media[^{]*\((?:min|max)-width\s*:\s*([\d.]+(?:px|em|rem))/g)) breakpoints.add(m[1]);
  cssInfo.push({
    file: rel(f),
    size: statSync(f).size,
    imports,
    fontFaces: (text.match(/@font-face/g) ?? []).length,
    urlRefs: urls.length,
    usesExternalFonts: /fonts\.googleapis|cdn\.jsdelivr|spoqa|pretendard|noonnu/i.test(text),
  });
}

// ---------- Build result ----------
const layoutCandidates = [];
for (const [key, entry] of blockMap) {
  const allPages = new Set([...entry.strict.values()].flatMap((s) => [...s]));
  if (allPages.size < 2) continue;
  const differs = entry.strict.size === 1 ? 'identical' : entry.normalized.size === 1 ? 'active-state' : 'content';
  layoutCandidates.push({ block: key, pages: allPages.size, variants: entry.strict.size, differs });
}
layoutCandidates.sort((a, b) => b.pages - a.pages);

const repeated = [...repeatMap]
  .map(([structure, v]) => ({ structure, maxCount: v.max, pages: v.pages.size }))
  .sort((a, b) => b.pages * 10 + b.maxCount - (a.pages * 10 + a.maxCount))
  .slice(0, 20);

const result = {
  root,
  counts: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length])),
  pages,
  layoutCandidates,
  repeatedStructures: repeated,
  libraries: [...libsFound].map(([name, sources]) => ({ name, sources: [...sources].slice(0, 3) })),
  customJs,
  vendorJs,
  jsPatterns: jsStats,
  css: cssInfo,
  breakpoints: [...breakpoints].sort((a, b) => parseFloat(a) - parseFloat(b)),
  brokenReferences: [...brokenRefs].map(([ref, from]) => ({ ref, from: [...from].slice(0, 3) })),
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// ---------- Markdown report ----------
const out = [];
const table = (head, rows) => {
  if (!rows.length) return '_none_';
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
};

out.push(`# Markup Inventory — ${root}`);
out.push(
  `**Files**: ${result.counts.html} HTML · ${result.counts.css} CSS · ${result.counts.js} JS · ${result.counts.images} images · ${result.counts.fonts} fonts · ${result.counts.media} media · ${result.counts.other} other`,
);

out.push('\n## Pages');
out.push(
  table(
    ['Page', 'Title', 'CSS', 'JS', 'Inline scripts', 'on* handlers', 'Forms'],
    pages.map((p) => [p.page, p.title || '-', p.css.length, p.js.length, p.inlineScripts, p.inlineHandlers, p.forms]),
  ),
);

out.push('\n## Layout candidates (shared across pages)');
out.push(
  table(
    ['Block', 'Pages', 'Variants', 'Suggestion'],
    layoutCandidates.map((c) => [
      `\`${c.block}\``,
      c.pages,
      c.variants,
      c.differs === 'identical'
        ? 'identical → one layout component'
        : c.differs === 'active-state'
          ? 'only on/active classes differ → one component, derive active item from the route'
          : 'content differs → one component + props, or per-section variants',
    ]),
  ),
);

out.push('\n## Repeated structures (list/card component candidates)');
out.push(table(['Structure', 'Max siblings', 'Pages'], repeated.map((r) => [`\`${r.structure}\``, r.maxCount, r.pages])));

out.push('\n## JavaScript');
out.push(`**Libraries**: ${result.libraries.length ? result.libraries.map((l) => l.name).join(', ') : 'none detected'}`);
out.push(`**Custom scripts**: ${customJs.length ? customJs.map((j) => `${j.file} (${kb(j.size)})`).join(', ') : 'none'}`);
out.push(`**Vendor scripts**: ${vendorJs.length ? vendorJs.join(', ') : 'none'}`);
out.push(table(['Pattern (custom + inline code)', 'Occurrences'], Object.entries(jsStats).filter(([, v]) => v).map(([k, v]) => [k, v])));

out.push('\n## CSS');
out.push(table(['File', 'Size', '@import', '@font-face', 'url() refs'], cssInfo.map((c) => [c.file, kb(c.size), c.imports.length, c.fontFaces, c.urlRefs])));
out.push(`**Breakpoints**: ${result.breakpoints.length ? result.breakpoints.join(', ') : 'none detected'}`);

out.push('\n## Broken local references');
out.push(
  result.brokenReferences.length
    ? result.brokenReferences.slice(0, 30).map((b) => `- \`${b.ref}\` ← ${b.from.join(', ')}`).join('\n')
    : '_none_',
);

console.log(out.join('\n'));
