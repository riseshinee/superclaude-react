// Minimal, forgiving HTML parser for publisher markup (zero dependencies).
// Produces a tree of { type: 'root' | 'element' | 'text' | 'comment' } nodes.

export const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

// Opening <key> implicitly closes an open element listed in the value
const IMPLICIT_CLOSE = {
  li: ['li'],
  option: ['option'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
};
const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'fieldset', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

const TAG_OPEN_RE = /<([a-zA-Z][\w:-]*)/y;
const TAG_CLOSE_RE = /<\/([a-zA-Z][\w:-]*)\s*>/y;
const WS_RE = /\s*/y;
const ATTR_NAME_RE = /[^\s"'>\/=]+/y;
const UNQUOTED_RE = /[^\s>]+/y;

export function parseHtml(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  const current = () => stack[stack.length - 1];
  const n = html.length;
  let i = 0;

  const pushText = (value) => {
    if (!value) return;
    const kids = current().children;
    const last = kids[kids.length - 1];
    if (last && last.type === 'text') last.value += value;
    else kids.push({ type: 'text', value });
  };

  const closeTag = (tag) => {
    for (let k = stack.length - 1; k > 0; k--) {
      if (stack[k].tag === tag) {
        stack.length = k;
        return;
      }
    }
    // stray closing tag: ignore
  };

  while (i < n) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      current().children.push({ type: 'comment', value: html.slice(i + 4, end === -1 ? n : end) });
      i = end === -1 ? n : end + 3;
      continue;
    }
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const end = html.indexOf('>', i);
      i = end === -1 ? n : end + 1;
      continue;
    }
    if (html[i] === '<' && html[i + 1] === '/') {
      TAG_CLOSE_RE.lastIndex = i;
      const m = TAG_CLOSE_RE.exec(html);
      if (m) {
        closeTag(m[1].toLowerCase());
        i = TAG_CLOSE_RE.lastIndex;
        continue;
      }
    }
    if (html[i] === '<') {
      const parsed = parseStartTag(html, i);
      if (parsed) {
        const { el, selfClosing, end } = parsed;
        i = end;
        const parent = current();
        if (parent.type === 'element') {
          if (IMPLICIT_CLOSE[el.tag]?.includes(parent.tag)) stack.pop();
          else if (parent.tag === 'p' && CLOSES_P.has(el.tag)) stack.pop();
        }
        current().children.push(el);
        el.parent = current();
        if (VOID_TAGS.has(el.tag) || selfClosing) continue;
        if (RAW_TEXT_TAGS.has(el.tag)) {
          const closeRe = new RegExp(`</${el.tag}\\s*>`, 'ig');
          closeRe.lastIndex = i;
          const m = closeRe.exec(html);
          const endIdx = m ? m.index : n;
          const text = html.slice(i, endIdx);
          if (text) el.children.push({ type: 'text', value: text, raw: true });
          i = m ? closeRe.lastIndex : n;
          continue;
        }
        stack.push(el);
        continue;
      }
    }
    let next = html.indexOf('<', i + 1);
    if (next === -1) next = n;
    pushText(html.slice(i, next));
    i = next;
  }
  return root;
}

function parseStartTag(html, start) {
  TAG_OPEN_RE.lastIndex = start;
  const m = TAG_OPEN_RE.exec(html);
  if (!m) return null;
  const el = { type: 'element', name: m[1], tag: m[1].toLowerCase(), attrs: [], children: [] };
  let i = TAG_OPEN_RE.lastIndex;
  const n = html.length;
  while (i < n) {
    WS_RE.lastIndex = i;
    WS_RE.exec(html);
    i = WS_RE.lastIndex;
    if (html[i] === '>') return { el, selfClosing: false, end: i + 1 };
    if (html[i] === '/' && html[i + 1] === '>') return { el, selfClosing: true, end: i + 2 };
    if (html[i] === '/') {
      i++;
      continue;
    }
    ATTR_NAME_RE.lastIndex = i;
    const nameMatch = ATTR_NAME_RE.exec(html);
    if (!nameMatch) {
      i++;
      continue;
    }
    i = ATTR_NAME_RE.lastIndex;
    WS_RE.lastIndex = i;
    WS_RE.exec(html);
    let value = null;
    if (html[WS_RE.lastIndex] === '=') {
      i = WS_RE.lastIndex + 1;
      WS_RE.lastIndex = i;
      WS_RE.exec(html);
      i = WS_RE.lastIndex;
      const q = html[i];
      if (q === '"' || q === "'") {
        const close = html.indexOf(q, i + 1);
        value = html.slice(i + 1, close === -1 ? n : close);
        i = close === -1 ? n : close + 1;
      } else {
        UNQUOTED_RE.lastIndex = i;
        const v = UNQUOTED_RE.exec(html);
        value = v ? v[0] : '';
        i = v ? UNQUOTED_RE.lastIndex : i;
      }
    }
    el.attrs.push({ name: nameMatch[0], value });
  }
  return { el, selfClosing: false, end: n };
}

export function getAttr(el, name) {
  const a = el.attrs?.find((x) => x.name.toLowerCase() === name);
  return a ? (a.value ?? '') : undefined;
}

export function classList(el) {
  return (getAttr(el, 'class') ?? '').split(/\s+/).filter(Boolean);
}

export function* walk(node) {
  for (const child of node.children ?? []) {
    yield child;
    if (child.type === 'element') yield* walk(child);
  }
}

// Supports: tag, #id, .class, tag#id, tag.class.other
export function querySelector(node, selector) {
  const m = selector.trim().match(/^([a-zA-Z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)$/);
  if (!m) throw new Error(`Unsupported selector "${selector}" (use tag, #id, .class, or tag.class)`);
  const [, tag, id, classes] = m;
  const wanted = classes ? classes.split('.').filter(Boolean) : [];
  for (const el of walk(node)) {
    if (el.type !== 'element') continue;
    if (tag && el.tag !== tag.toLowerCase()) continue;
    if (id && getAttr(el, 'id') !== id.slice(1)) continue;
    if (wanted.length) {
      const cls = classList(el);
      if (!wanted.every((c) => cls.includes(c))) continue;
    }
    return el;
  }
  return null;
}

export function textContent(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textContent).join('');
}

export function serializeHtml(node, { dropClasses = new Set() } = {}) {
  if (node.type === 'text') return node.value;
  if (node.type === 'comment') return '';
  const inner = (node.children ?? []).map((c) => serializeHtml(c, { dropClasses })).join('');
  if (node.type === 'root') return inner;
  const attrs = node.attrs
    .filter((a) => a.name.toLowerCase() !== 'aria-current')
    .map((a) => {
      let v = a.value;
      if (a.name.toLowerCase() === 'class' && v != null) {
        v = v.split(/\s+/).filter((c) => c && !dropClasses.has(c)).join(' ');
      }
      return v == null ? ` ${a.name}` : ` ${a.name}="${v}"`;
    })
    .join('');
  return VOID_TAGS.has(node.tag) ? `<${node.tag}${attrs}>` : `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}
