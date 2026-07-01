#!/usr/bin/env node
/*
 * Phase 4 — Developer docs migration.
 *
 * Walks sources/mattermost-developer-documentation/site/content/{contribute,
 * integrate,internal}/, converts Hugo MD + shortcodes to MDX, and writes
 * the result under develop/.
 *
 * Shortcodes handled:
 *   {{< newtabref href="X" title="Y" >}}      → [Y](X) (markdown link; MDX picks it up)
 *   {{< ref "/path" >}}                       → /developers/path (Docusaurus route)
 *   {{< relref "rel/path.md" >}}              → resolved relative path
 *   {{< note "Title:" >}} … {{< /note >}}     → <Note title="Title">…</Note>
 *   {{< tabs >}}{{< tab "X" >}}…{{</tab>}}…   → <Tabs><TabItem value="x" label="X">…</TabItem></Tabs>
 *   {{< compass-icon icon-name >}}            → <CompassIcon name="name" />
 *   {{< goversion >}}                         → leaves a static placeholder; manual update later
 *   Unknown shortcodes                        → leaves a TODO comment + the original text
 *
 * Frontmatter:
 *   title:              kept
 *   heading:            dropped (Docusaurus auto-renders title as H1)
 *   weight:             → sidebar_position
 *   subsection / subsection_url: dropped (handled by sidebar config)
 *
 * Files:
 *   _index.md → index.md
 *   *.md      → *.md  (kept as MDX-compatible markdown)
 *   Sections that don't have an _index.md get one auto-generated.
 *
 * Run:
 *   node docs-site/scripts/migrate-developer-docs.mjs
 *
 * Idempotent — overwrites develop/ each run. Logs unknown shortcodes to
 * /tmp/migrate-unknown-shortcodes.log for manual follow-up.
 */

import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync} from 'node:fs';
import {dirname, join, relative, resolve, basename, extname} from 'node:path';

const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
const SRC = join(REPO_ROOT, 'sources/mattermost-developer-documentation/site/content');
const DST = join(REPO_ROOT, 'develop');
const SECTIONS = ['contribute', 'integrate', 'internal'];
const UNKNOWN_LOG = '/tmp/migrate-unknown-shortcodes.log';

const stats = {
  files: 0,
  newtabref: 0,
  ref: 0,
  relref: 0,
  note: 0,
  tabs: 0,
  compassIcon: 0,
  unknown: new Map(),
};

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return {fm: {}, body: text};
  const lines = m[1].split('\n');
  const fm = {};
  for (const line of lines) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      // Strip wrapping quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      fm[kv[1]] = v;
    }
  }
  return {fm, body: text.slice(m[0].length)};
}

function emitFrontmatter(fm) {
  const out = ['---'];
  if (fm.title) out.push(`title: ${JSON.stringify(fm.title)}`);
  if (fm.description) out.push(`description: ${JSON.stringify(fm.description)}`);
  if (fm.sidebar_position != null) out.push(`sidebar_position: ${fm.sidebar_position}`);
  if (fm.sidebar_label) out.push(`sidebar_label: ${JSON.stringify(fm.sidebar_label)}`);
  if (fm.id) out.push(`id: ${JSON.stringify(fm.id)}`);
  out.push('---', '');
  return out.join('\n');
}

function transformFrontmatter(fm) {
  const out = {title: fm.title || fm.heading};
  if (fm.weight) {
    const n = Number(fm.weight);
    if (!Number.isNaN(n)) out.sidebar_position = n;
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
 * Shortcode transforms (applied in order)
 * ──────────────────────────────────────────────────────────────── */

// {{< newtabref href="X" title="Y" >}} — title may contain `<>` (generics in API names).
// Match laziest until the closing `>}}` literal. The `(.+?)\s*>\}\}` is anchored
// to the trailing `>}}` so embedded `>` inside the attrs is fine.
function convertNewtabref(text) {
  return text.replace(
    /\{\{<\s*newtabref\s+([\s\S]+?)\s*>\}\}/gi,
    (_, attrs) => {
      const href = attrs.match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/i);
      const title = attrs.match(/title\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/i);
      const h = href ? (href[1] || href[2] || href[3]) : '';
      const t = title ? (title[1] || title[2] || title[3]) : h;
      stats.newtabref++;
      // Escape pipes (markdown table cell separators) and brackets in the
      // displayed text so the markdown link parses cleanly.
      const safeT = t.replace(/\|/g, '\\|').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
      return `[${safeT}](${h})`;
    },
  );
}

// {{< ref "/path/to/page" >}} or {{< ref "page" >}}
function convertRef(text) {
  return text.replace(
    /\{\{<\s*ref\s+(?:"([^"]+)"|'([^']+)')\s*>\}\}/gi,
    (_, q1, q2) => {
      const path = (q1 || q2).replace(/\.md$/, '').replace(/^\/?/, '/');
      // Hugo refs that are absolute (/contribute/...) map to /developers/<...>
      // because we're dropping each section under /developers.
      const rewritten = path.replace(/^\/(contribute|integrate|internal)/, '/developers/$1');
      stats.ref++;
      return rewritten;
    },
  );
}

// {{< relref "..." >}} same-document relative refs — convert to /developers prefix
function convertRelref(text) {
  return text.replace(
    /\{\{<\s*relref\s+(?:"([^"]+)"|'([^']+)')\s*>\}\}/gi,
    (_, q1, q2) => {
      const path = (q1 || q2).replace(/\.md$/, '').replace(/^\/?/, '/');
      const rewritten = path.replace(/^\/(contribute|integrate|internal)/, '/developers/$1');
      stats.relref++;
      return rewritten;
    },
  );
}

// {{< note "Title:" >}} ... {{</note>}}  OR  {{< note >}} ... {{</note>}}  (no title)
// Also handles the percent form: {{% note "Title:" %}} ... {{% /note %}}
function convertNote(text) {
  // Handle both delimiter forms in one pass.
  for (const [open, close] of [['<', '>'], ['%', '%']]) {
    const re = new RegExp(
      `\\{\\{${open}\\s*note(?:\\s+(?:"([^"]*)"|'([^']*)'))?\\s*${close}\\}\\}([\\s\\S]*?)\\{\\{${open}\\s*\\/\\s*note\\s*${close}\\}\\}`,
      'gi',
    );
    text = text.replace(re, (_, t1, t2, body) => {
      stats.note++;
      const title = (t1 || t2 || '').replace(/[:：]\s*$/, '').trim();
      const titleAttr = title ? ` title=${JSON.stringify(title)}` : '';
      return `\n<Note${titleAttr}>\n${body.trim()}\n</Note>\n`;
    });
  }
  return text;
}

// Tabs/tab.
//
// Two syntaxes used in the source:
//   1. Simple:    {{< tabs >}}{{< tab "Label" >}}...{{< /tab >}}{{< /tabs >}}
//   2. Positional (the wider-used one in this repo):
//        {{<tabs "groupName" "id1,Label1;id2,Label2;..." "default-id">}}
//          {{<tab "id1" "css">}}body{{</tab>}}
//          {{<tab "id2" "css">}}body{{</tab>}}
//        {{</tabs>}}
//
// We parse both shapes into <Tabs><TabItem value="id" label="Label">…</TabItem></Tabs>.
function convertTabs(text) {
  // Simple form first (named tab labels in the inner shortcode).
  text = text.replace(
    /\{\{<\s*tabs\s*>\}\}([\s\S]*?)\{\{<\s*\/\s*tabs\s*>\}\}/gi,
    (_, body) => {
      stats.tabs++;
      const items = body.replace(
        /\{\{<\s*tab\s+(?:"([^"]*)"|'([^']*)')\s*>\}\}([\s\S]*?)\{\{<\s*\/\s*tab\s*>\}\}/gi,
        (_, l1, l2, b) => {
          const label = l1 || l2 || '';
          const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return `<TabItem value=${JSON.stringify(value)} label=${JSON.stringify(label)}>\n${b.trim()}\n</TabItem>\n`;
        },
      );
      return `<Tabs>\n${items.trim()}\n</Tabs>\n`;
    },
  );

  // Positional form (Mattermost dev-docs convention) — implicit close.
  //
  // The Mattermost Hugo theme used `{{<tabs "name" "id1,Label1;id2,Label2" "default">}}`
  // WITHOUT a closing `{{</tabs>}}`. The block is implicitly terminated at
  // the next `### ` markdown heading or the next `{{<tabs ...>}}` opening.
  // We find each opening, slice forward until the next terminator, then
  // process inner tabs.
  const positionalOpen = /\{\{<\s*tabs\s+("[^"]*"|'[^']*')\s+("[^"]*"|'[^']*')(?:\s+("[^"]*"|'[^']*'))?\s*>\}\}/gi;
  const matches = [...text.matchAll(positionalOpen)];
  if (matches.length) {
    // Walk in reverse so positions stay valid as we splice the source.
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const start = m.index;
      // Find the terminator: earliest of next `\n### `, next positional open, or EOF.
      const tail = text.slice(m.index + m[0].length);
      const candidates = [
        tail.search(/\n#{1,3} /),
        tail.search(/\{\{<\s*tabs\s+["']/),
      ].filter((n) => n >= 0);
      const stop = candidates.length ? Math.min(...candidates) : tail.length;
      const body = tail.slice(0, stop);
      const after = tail.slice(stop);

      stats.tabs++;
      const idLabelStr = m[2].slice(1, -1);
      const labelMap = new Map();
      for (const pair of idLabelStr.split(';')) {
        const [id, label] = pair.split(',').map((s) => s.trim());
        if (id) labelMap.set(id, label || id);
      }

      const items = body.replace(
        /\{\{<\s*tab\s+(?:"([^"]*)"|'([^']*)')(?:\s+(?:"[^"]*"|'[^']*'))*\s*>\}\}([\s\S]*?)\{\{<\s*\/\s*tab\s*>\}\}/gi,
        (_, id1, id2, b) => {
          const id = id1 || id2;
          const label = labelMap.get(id) || id;
          return `<TabItem value=${JSON.stringify(id)} label=${JSON.stringify(label)}>\n${b.trim()}\n</TabItem>\n`;
        },
      );

      const replaced = `<Tabs>\n${items.trim()}\n</Tabs>\n`;
      text = text.slice(0, start) + replaced + after;
    }
  }

  return text;
}

// {{< goversion >}} — inline placeholder for the Mattermost-Server-blessed Go
// version. Hugo had a custom shortcode that read from a config; in MDX we just
// emit a static string. Update GO_VERSION here when the platform bumps Go.
const GO_VERSION = '1.22';
function convertGoversion(text) {
  return text.replace(/\{\{<\s*goversion\s*>\}\}/gi, GO_VERSION);
}

// {{< table >}} … {{< /table >}}  OR  {{< table "name" >}} … {{< /table >}}
// — sometimes used to wrap a markdown table with optional name. Drop the
// wrapper; the markdown table inside renders fine on its own.
function convertTable(text) {
  return text.replace(
    /\{\{<\s*table(?:\s+(?:"[^"]*"|'[^']*'))?\s*>\}\}([\s\S]*?)\{\{<\s*\/\s*table\s*>\}\}/gi,
    (_, body) => body,
  );
}

// Plugin schema shortcodes (pluginmanifestdocs / pluginjsdocs / plugingoexamplecode /
// plugingodocs) — these used to render auto-generated content from the plugin
// repo. Out of scope for v1; replace with a TODO callout pointing at the
// upstream source.
function convertPluginShortcodes(text) {
  return text.replace(
    /\{\{<\s*(pluginmanifestdocs|pluginjsdocs|plugingoexamplecode|plugingodocs)\s*>\}\}/gi,
    (_, name) => `\n<Note title="Generated content (migrating)">\n\nThis section was rendered by the Hugo \`${name}\` shortcode from the upstream plugin reference. Migration follow-up — see PLAN.md §11.2.\n\n</Note>\n`,
  );
}

// {{< compass-icon icon-name >}}  (note: hyphenated identifier, no quotes)
function convertCompassIcon(text) {
  return text.replace(
    /\{\{<\s*compass-icon\s+([a-z-]+)\s*>\}\}/gi,
    (_, name) => {
      stats.compassIcon++;
      const cleaned = name.replace(/^icon-/, '');
      return `<CompassIcon name=${JSON.stringify(cleaned)} />`;
    },
  );
}

// Unknown shortcodes → leave as TODO comment + original text
function flagUnknownShortcodes(text, filePath) {
  // Both `{{< ... >}}` and `{{% ... %}}` Hugo shortcode forms.
  return text.replace(
    /\{\{[<%]\s*([a-z-]+)([^}]*?)\s*[%>]\}\}/gi,
    (m, name) => {
      stats.unknown.set(name, (stats.unknown.get(name) || 0) + 1);
      // Sanitize the comment so it can't break MDX: strip backticks and
      // trim length; full original is reachable from the source path.
      const safe = m.replace(/`/g, "'").slice(0, 120);
      return `{/* TODO: unconverted Hugo shortcode ${safe} (${filePath}) */}`;
    },
  );
}

// {{% content "path/to/section.md" %}}  — Hugo's transclusion shortcode.
// We don't recursively inline; replace with a TODO callout that links to
// what would have been included. The migration follow-up resolves these
// (most are organizational sub-pages that should become standalone files
// in the new IA).
function convertContentInclude(text) {
  return text.replace(
    /\{\{%\s*content\s+(?:"([^"]+)"|'([^']+)')\s*%\}\}/gi,
    (_, p1, p2) => {
      const includePath = p1 || p2;
      return `\n<Note title="Section moved">\n\nThis section's content used to be transcluded from \`${includePath}\` via Hugo's \`{{% content %}}\` shortcode. In the new IA each include is its own page — see the sidebar.\n\n</Note>\n`;
    },
  );
}

// Self-close common HTML void elements that markdown tolerates but MDX
// rejects (MDX requires every tag to be a valid JSX element).
function selfCloseVoidTags(text) {
  // Skip fenced code blocks and inline code only. Indented code-block
  // detection here is unsafe (false-positives within nested list items
  // where leading whitespace is structural). Self-closing void tags is
  // harmless inside an indented "code" block — the rendered text shows
  // `<br/>` instead of `<br>` either way.
  return text.replace(
    /(```[\s\S]*?```|`[^`\n]+`)|(<(br|hr|img|input|meta|link|wbr)\b([^>]*?)(?<!\/)>)/gi,
    (m, codeBlock, _full, tag, attrs) => {
      if (codeBlock) return codeBlock;
      const a = (attrs || '').trim();
      return `<${tag}${a ? ' ' + a : ''}/>`;
    },
  );
}

// MDX-safety pass for stray `<tag>` references in prose (like `[<iframe>](url)`
// — markdown link with HTML-element-as-text — and `npm run package:<os>` —
// placeholder in indented code).
//
// Strategy: only escape `<` when it's clearly NOT opening a real JSX/HTML
// element. Real elements have a closing tag or are in our void list. Naïve
// catch-all: escape `<` followed by lowercase letters where the same word
// is NOT followed later by a matching closer in the same paragraph.
//
// Cheaper version: explicit allow-list of "tags" we know are common HTML/JSX
// elements in our content. Anything else with `<word>` becomes `&lt;word&gt;`
// in non-code context.
function escapeProseHtmlTags(text) {
  const KNOWN = new Set([
    // Elements that already produce valid MDX components when seen in prose
    'Note', 'Tip', 'Warning', 'Security', 'Hero', 'Eyebrow', 'PlanBadge',
    'CompassIcon', 'StatStrip', 'MethodLegend', 'CardGrid', 'Tabs', 'TabItem',
    // Standard HTML that MDX accepts
    'div', 'span', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'br', 'hr', 'img', 'input', 'meta', 'link', 'wbr',
    // Note: `iframe` deliberately excluded — Mattermost dev docs use it as
    // text ("`<iframe>` element"), not as a live element. Escaping prevents
    // MDX from looking for a closing tag.
    'b', 'i', 'u', 's', 'sup', 'sub', 'kbd', 'mark', 'small', 'svg', 'path',
    'details', 'summary', 'blockquote', 'figure', 'figcaption', 'video', 'audio',
    'source', 'picture', 'main', 'aside', 'nav', 'header', 'footer', 'section',
    'article', 'cite', 'q', 'abbr', 'address',
  ]);
  // For each `<word>` not in the allow-list and not in a code context,
  // escape the angle brackets.
  return text.replace(
    /(```[\s\S]*?```|^ {4,}.+$|`[^`\n]+`)|<\s*\/?\s*([A-Za-z][A-Za-z0-9-]*)\b([^>]*)>/gm,
    (m, codeBlock, tag, _rest) => {
      if (codeBlock) return codeBlock;
      if (KNOWN.has(tag)) return m;
      // Looks like a placeholder or doc-text reference — escape it.
      return m.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
  );
}

// Convert HTML `style="prop: val; prop: val"` attribute to JSX
// `style={{propName: 'val', propName: 'val'}}` form.
function convertHtmlStyleAttr(text) {
  return text.replace(
    /style="([^"]+)"/g,
    (_, css) => {
      const props = css
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((decl) => {
          const idx = decl.indexOf(':');
          if (idx === -1) return null;
          const prop = decl.slice(0, idx).trim();
          const val = decl.slice(idx + 1).trim();
          // CSS prop-name → camelCase JS prop name
          const jsProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return `${jsProp}: '${val.replace(/'/g, "\\'")}'`;
        })
        .filter(Boolean)
        .join(', ');
      return `style={{${props}}}`;
    },
  );
}

// Markdown link text containing JS-like braces. e.g.
//   [getOptions(o: O) {const x = {...o}}](url)
// MDX parses the `{...}` inside the link text as a JSX expression and
// blows up. Escape braces inside link text only.
function escapeLinkTextBraces(text) {
  return text.replace(
    /\[([^\]\n]*?)\](?=\([^)\n]+\))/g,
    (m, linkText) => {
      if (!/[{}]/.test(linkText)) return m;
      return `[${linkText.replace(/\{/g, '\\{').replace(/\}/g, '\\}')}]`;
    },
  );
}

// Escape `{` and `}` in prose (placeholder text like `{TestName}` or
// query selectors like `{prometheus_label="x"}`) so MDX doesn't try to
// parse them as JSX expressions.
//
// Skip:
//   - Fenced code blocks (```...```)
//   - Inline code (`...`)
//   - Existing JSX tags (we converted shortcodes to <Note>, <Tabs>, etc.;
//     those use {prop} expressions internally and must be preserved)
//
// Implemented as a line-walker that tracks fence state and per-line
// scans for ` ` ` and JSX tags to avoid false positives.
function escapeProseBraces(text) {
  const lines = text.split('\n');
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    // Walk the line, skipping inline code spans and JSX-ish tags.
    let result = '';
    let i = 0;
    while (i < line.length) {
      const c = line[i];
      // Inline code
      if (c === '`') {
        const j = line.indexOf('`', i + 1);
        if (j === -1) { result += line.slice(i); break; }
        result += line.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      // JSX-ish open tag: `<Word...>` or `<Word .../>` or `</Word>` —
      // capture verbatim including any internal `{...}` props.
      if (c === '<' && /[A-Za-z!\/]/.test(line[i + 1] || '')) {
        // Find the closing `>`. Account for `>` inside `"..."` attrs.
        let depth = 1;
        let j = i + 1;
        while (j < line.length && depth > 0) {
          if (line[j] === '"') {
            const close = line.indexOf('"', j + 1);
            if (close === -1) break;
            j = close + 1;
            continue;
          }
          if (line[j] === '>') { depth--; j++; break; }
          j++;
        }
        result += line.slice(i, j);
        i = j;
        continue;
      }
      // Backslash-escaped brace already → keep as-is.
      if (c === '\\' && (line[i + 1] === '{' || line[i + 1] === '}')) {
        result += line.slice(i, i + 2);
        i += 2;
        continue;
      }
      // Bare brace in prose: escape.
      if (c === '{' || c === '}') {
        result += '\\' + c;
        i++;
        continue;
      }
      result += c;
      i++;
    }
    out.push(result);
  }
  return out.join('\n');
}

// Heading anchor IDs ({#anchor-id}) are supposed to work in Docusaurus 3
// but acorn balks on a few patterns (notably when the heading starts with
// a digit-period like "4. Foo {#anchor}", which leading-list-item-like).
// Drop the explicit IDs — Docusaurus auto-generates from heading text.
function stripHeadingAnchorIds(text) {
  return text.replace(/^(#{1,6}\s+.+?)\s*\{#[A-Za-z0-9_-]+\}\s*$/gm, '$1');
}

// Convert standalone 4-space-indented code blocks to fenced blocks.
// MDX 3 doesn't support indented code blocks; indented "code" gets parsed
// as paragraph text and any `<tag>` inside it triggers JSX errors.
//
// Implemented as a line-by-line state machine instead of a regex — the
// pure-regex form catastrophically backtracks on files with mixed-depth
// indents (8/12/16 spaces in nested lists).
function fenceIndentedCodeBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  let inFence = false;        // are we currently inside a ``` ... ``` block?
  while (i < lines.length) {
    const line = lines[i];
    // Track fence state — leave the contents of fenced blocks alone.
    if (/^```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }
    if (inFence) {
      out.push(line);
      i++;
      continue;
    }

    const prevBlank = i === 0 || lines[i - 1].trim() === '';
    if (prevBlank && /^ {4}\S/.test(line)) {
      // Look back for a list-context signal — 4-space indents inside a
      // list item are continuation, not code.
      let prevNonBlank = '';
      for (let j = i - 2; j >= 0; j--) {
        if (lines[j].trim() !== '') { prevNonBlank = lines[j]; break; }
      }
      const inList = /^[ \t]*([-*+]|\d+\.)\s/.test(prevNonBlank);
      if (!inList) {
        const block = [];
        while (i < lines.length && (lines[i].startsWith('    ') || lines[i].trim() === '')) {
          block.push(lines[i]);
          i++;
        }
        while (block.length && block[block.length - 1].trim() === '') {
          i--;
          block.pop();
        }
        // Skip the rewrite if the block contains a triple-backtick line —
        // the source had its own fenced block that just happens to be
        // 4-space-indented (e.g. inside a numbered list whose list-context
        // detection above didn't catch). Re-fencing would produce nested,
        // mismatched fences.
        const containsFence = block.some((l) => /^\s*```/.test(l));
        if (containsFence) {
          out.push(...block);
          continue;
        }
        const stripped = block.map((l) => l.replace(/^ {4}/, '')).join('\n');
        out.push('```text', stripped, '```');
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

/* ──────────────────────────────────────────────────────────────────
 * MDX-safety pass
 * ──────────────────────────────────────────────────────────────── */

// Escape characters that confuse MDX. Most prose is fine; the common
// gotchas are < followed by non-letter (looks like JSX) and { followed
// by something that looks like an expression.
function mdxSanitize(text) {
  // Inside fenced code blocks, leave content alone.
  return text.replace(/(```[\s\S]*?```|`[^`\n]+`|<[A-Za-z][^>]*>[\s\S]*?<\/[A-Za-z]+>|<[A-Za-z][^>]*\/>)|([^])/g, (m, codeOrTag, other) => {
    if (codeOrTag) return codeOrTag;
    // For non-code text: escape `<` not followed by a letter or `!`
    return other.replace(/<(?=[^a-zA-Z!\/])/g, '&lt;');
  });
}

/* ──────────────────────────────────────────────────────────────────
 * Per-file pipeline
 * ──────────────────────────────────────────────────────────────── */

function processFile(srcPath, dstPath) {
  process.stderr.write(`[migrate]   ${relative(REPO_ROOT, srcPath)}\n`);
  let content = readFileSync(srcPath, 'utf8');
  const {fm, body} = parseFrontmatter(content);
  const newFm = transformFrontmatter(fm);

  let mdx = body;
  // Multi-line shortcodes first (consume the full block before single-line
  // transforms peek inside).
  mdx = convertNote(mdx);
  mdx = convertTabs(mdx);
  mdx = convertTable(mdx);
  // Single-line / inline shortcodes.
  mdx = convertNewtabref(mdx);
  mdx = convertCompassIcon(mdx);
  mdx = convertGoversion(mdx);
  mdx = convertPluginShortcodes(mdx);
  mdx = convertContentInclude(mdx);
  mdx = convertRef(mdx);
  mdx = convertRelref(mdx);
  // Anything left is unknown — flag for manual follow-up.
  mdx = flagUnknownShortcodes(mdx, relative(REPO_ROOT, srcPath));
  // MDX hygiene: self-close void HTML tags so MDX doesn't choke on `<br>`.
  mdx = selfCloseVoidTags(mdx);
  // Escape stray `<tag>` text references in prose (e.g. `[<iframe>](url)`).
  mdx = escapeProseHtmlTags(mdx);
  // Drop explicit `{#anchor-id}` heading IDs — Docusaurus auto-generates them.
  mdx = stripHeadingAnchorIds(mdx);
  // Escape `{` and `}` inside markdown link text (MDX would otherwise
  // treat them as JSX expressions).
  mdx = escapeLinkTextBraces(mdx);
  // Convert HTML style="..." to JSX style={{}} (JSX won't accept string).
  mdx = convertHtmlStyleAttr(mdx);
  // Escape {} in prose so MDX doesn't try to evaluate placeholder text
  // (e.g. `{TestName}` or `{prom_label=~"foo"}`) as JSX expressions.
  // Runs LAST so it doesn't escape `{...}` inside JSX tags we created
  // (Note title=..., Tabs, TabItem value=...).
  mdx = escapeProseBraces(mdx);
  // Convert 4-space indented code blocks to fenced ``` blocks (MDX 3 does
  // not support the indented code-block form).
  mdx = fenceIndentedCodeBlocks(mdx);

  // For tab usage we need to also import Tabs/TabItem at top of file
  // since they're not globally registered. Simpler: register them
  // globally in MDXComponents and skip imports here.

  const out = emitFrontmatter(newFm) + mdx;
  mkdirSync(dirname(dstPath), {recursive: true});
  writeFileSync(dstPath, out);
  stats.files++;
}

function walkAndMigrate(srcDir, dstDir) {
  for (const name of readdirSync(srcDir)) {
    const srcPath = join(srcDir, name);
    const st = statSync(srcPath);
    if (st.isDirectory()) {
      walkAndMigrate(srcPath, join(dstDir, name));
    } else if (st.isFile() && extname(name) === '.md') {
      // Hugo's _index.md → Docusaurus index.md
      const dstName = name === '_index.md' ? 'index.md' : name;
      processFile(srcPath, join(dstDir, dstName));
    } else if (st.isFile() && !['.md', '.lock'].includes(extname(name))) {
      // Copy assets (images, etc.) verbatim
      mkdirSync(dstDir, {recursive: true});
      writeFileSync(join(dstDir, name), readFileSync(srcPath));
    }
  }
}

/* ──────────────────────────────────────────────────────────────────
 * Main
 * ──────────────────────────────────────────────────────────────── */

function main() {
  if (!existsSync(SRC)) {
    console.error(`source not found: ${SRC}`);
    console.error('Run: cd sources && git clone --depth=1 https://github.com/mattermost/mattermost-developer-documentation.git');
    process.exit(1);
  }

  // Wipe everything except our hand-authored develop/index.mdx so a re-run
  // produces a clean tree.
  const indexBackup = existsSync(join(DST, 'index.mdx'))
    ? readFileSync(join(DST, 'index.mdx'))
    : null;
  for (const name of (existsSync(DST) ? readdirSync(DST) : [])) {
    rmSync(join(DST, name), {recursive: true, force: true});
  }
  mkdirSync(DST, {recursive: true});
  if (indexBackup) writeFileSync(join(DST, 'index.mdx'), indexBackup);

  console.log(`[migrate] source: ${SRC}`);
  console.log(`[migrate] target: ${DST}`);

  for (const section of SECTIONS) {
    const srcDir = join(SRC, section);
    if (!existsSync(srcDir)) {
      console.warn(`[migrate] skip ${section}: missing in source`);
      continue;
    }
    walkAndMigrate(srcDir, join(DST, section));
  }

  console.log('\n[migrate] stats:');
  console.log(`  files migrated:    ${stats.files}`);
  console.log(`  newtabref → md:    ${stats.newtabref}`);
  console.log(`  ref:               ${stats.ref}`);
  console.log(`  relref:            ${stats.relref}`);
  console.log(`  note → <Note>:     ${stats.note}`);
  console.log(`  tabs → <Tabs>:     ${stats.tabs}`);
  console.log(`  compass-icon:      ${stats.compassIcon}`);
  if (stats.unknown.size) {
    console.log('  unknown shortcodes (left as TODO):');
    for (const [name, n] of [...stats.unknown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${name.padEnd(30)} ${n}`);
    }
    writeFileSync(UNKNOWN_LOG, [...stats.unknown.entries()].map(([k, v]) => `${k} ${v}`).join('\n'));
  }
}

main();
