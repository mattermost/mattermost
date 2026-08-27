/*
 * Guards the persona frontmatter rules.
 *
 * registry.test.mjs checks the personas we ship; these check the rules those
 * personas are held to, by feeding parsePersona text directly. Fixture files
 * cannot go in the personas directory — that directory is the registry, so a
 * fixture in it would be a reviewer.
 */

import {test} from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import {parsePersona} from './personas.mjs';

const VALID = {
  id: 'fixture',
  label: 'Fixture',
  scope: ['review'],
  docs_paths: ['docs/main'],
  router_hints: 'Applies to fixtures.',
};

const file = (meta, body = 'You are a fixture.') => `---\n${yaml.dump(meta)}---\n\n${body}\n`;
const withMeta = (overrides) => file({...VALID, ...overrides});

function withoutKey(key) {
  const meta = {...VALID};
  delete meta[key];
  return file(meta);
}

const REJECTED = [
  ['no frontmatter at all', 'You are a fixture.\n', /missing YAML frontmatter/],
  ['frontmatter that is never closed', '---\nid: fixture\n', /missing YAML frontmatter/],
  ['frontmatter that is not a mapping', '---\njust a string\n---\n\nBody.\n', /did not parse to an object/],
  ['empty frontmatter', '---\n---\n\nBody.\n', /did not parse to an object/],
  ['an empty prompt body', file(VALID, ''), /no prompt body/],
  ['a whitespace-only prompt body', file(VALID, '   \n'), /no prompt body/],
  ['an id that disagrees with the filename', withMeta({id: 'other'}), /does not match the filename/],
  ['a missing label', withoutKey('label'), /label is required/],
  ['an empty scope', withMeta({scope: []}), /scope must be a non-empty array/],
  ['an unknown scope', withMeta({scope: ['reviewer']}), /unknown scope "reviewer"/],
  ['missing docs_paths', withoutKey('docs_paths'), /docs_paths must be a non-empty array/],
  ['empty docs_paths', withMeta({docs_paths: []}), /docs_paths must be a non-empty array/],
  ['a non-string docs_paths entry', withMeta({docs_paths: [42]}), /every docs_paths entry must be/],
  ['a docs_paths entry that does not exist', withMeta({docs_paths: ['docs/main/nope']}), /"docs\/main\/nope" does not exist/],
  ['impact scope with no code_signals', withMeta({scope: ['review', 'impact']}), /code_signals must be a non-empty array/],
  ['impact scope with empty code_signals', withMeta({scope: ['review', 'impact'], code_signals: []}), /code_signals must be a non-empty array/],
  ['a non-string code_signals entry', withMeta({scope: ['review', 'impact'], code_signals: [null]}), /every code_signals entry must be/],
  ['missing router_hints', withoutKey('router_hints'), /router_hints is required/],
  ['blank router_hints', withMeta({router_hints: '   '}), /router_hints is required/],
];

for (const [name, raw, expected] of REJECTED) {
  test(`rejects ${name}`, () => {
    assert.throws(() => parsePersona('fixture.md', raw), expected);
  });
}

test('every rejection names the file it came from', () => {
  // Six personas load per run; an error that does not say which file it means
  // sends the reader through all of them.
  for (const [name, raw] of REJECTED) {
    assert.throws(
      () => parsePersona('fixture.md', raw),
      (err) => err.message.startsWith('fixture.md: '),
      name,
    );
  }
});

test('a minimal persona parses into the shape consumers expect', () => {
  assert.deepEqual(parsePersona('fixture.md', withMeta({})), {
    id: 'fixture',
    label: 'Fixture',
    scope: ['review'],
    docsPaths: ['docs/main'],
    codeSignals: [],
    routerHints: 'Applies to fixtures.',
    prompt: 'You are a fixture.',
    file: 'fixture.md',
  });
});

test('code_signals are required with impact scope and optional without', () => {
  const impact = parsePersona(
    'fixture.md',
    withMeta({scope: ['review', 'impact'], code_signals: ['server/public/model/']}),
  );
  assert.deepEqual(impact.codeSignals, ['server/public/model/']);

  // Declared without the scope: pointless, but validated rather than dropped,
  // so a persona that later gains impact scope is not silently empty.
  const reviewOnly = parsePersona('fixture.md', withMeta({code_signals: ['server/']}));
  assert.deepEqual(reviewOnly.codeSignals, ['server/']);
});

test('code_signals are not required to exist on disk', () => {
  // Deliberate: they are matched as prefixes and move with every server
  // refactor. Only docs_paths are checked.
  const persona = parsePersona(
    'fixture.md',
    withMeta({scope: ['impact'], code_signals: ['server/gone/away.go']}),
  );
  assert.deepEqual(persona.codeSignals, ['server/gone/away.go']);
});

test('a folded router hint arrives as one line', () => {
  // The hints are concatenated into the router prompt, where a stray newline
  // reads as the start of the next persona's entry.
  const raw = [
    '---',
    'id: fixture',
    'label: Fixture',
    'scope: [review]',
    'docs_paths:',
    '  - docs/main',
    'router_hints: >',
    '  Applies to administration content.',
    '  Skip end-user guides.',
    '---',
    '',
    'You are a fixture.',
    '',
  ].join('\n');

  assert.equal(
    parsePersona('fixture.md', raw).routerHints,
    'Applies to administration content. Skip end-user guides.',
  );
});

test('CRLF line endings parse the same as LF', () => {
  const lf = withMeta({});
  const crlf = lf.replaceAll('\n', '\r\n');

  assert.deepEqual(parsePersona('fixture.md', crlf), parsePersona('fixture.md', lf));
});

test('the prompt body keeps its internal structure', () => {
  const body = 'You are a fixture.\n\n## What to score\n\n- One thing.\n- Another.';
  const persona = parsePersona('fixture.md', file(VALID, body));

  assert.equal(persona.prompt, body);
});

test('a body containing a --- rule is not mistaken for frontmatter', () => {
  // splitFrontmatter takes the second delimiter, so a horizontal rule further
  // down must not truncate the prompt.
  const body = 'You are a fixture.\n\n---\n\nMore guidance below the rule.';
  const persona = parsePersona('fixture.md', file(VALID, body));

  assert.equal(persona.prompt, body);
});
