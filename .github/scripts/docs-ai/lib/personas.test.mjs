import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import yaml from 'js-yaml';
import {
  PERSONAS_DIR,
  PROMPTS_DIR,
  alwaysOnPersonaIds,
  conventions,
  getPersona,
  parsePersona,
  personaIds,
  personasWithScope,
  reviewContract,
  reviewSystemBlocks,
} from './personas.mjs';

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

const EXPECTED = [
  'brand-voice',
  'developer-dx',
  'economic-buyer',
  'end-user',
  'security-compliance',
  'system-admin',
];

test('prompt directories resolve from this module', () => {
  assert.ok(existsSync(PROMPTS_DIR), `${PROMPTS_DIR} does not exist`);
  assert.ok(existsSync(PERSONAS_DIR), `${PERSONAS_DIR} does not exist`);
});

test('every persona file parses and validates', () => {
  assert.deepEqual(personaIds(), EXPECTED);
});

test('all personas can review; a subset can author', () => {
  assert.deepEqual(personasWithScope('review').map((p) => p.id), EXPECTED);

  const authors = personasWithScope('author').map((p) => p.id);
  assert.deepEqual(authors, ['developer-dx', 'end-user', 'security-compliance', 'system-admin']);
});

test('brand-voice is the only always-on persona', () => {
  assert.deepEqual(alwaysOnPersonaIds(), ['brand-voice']);
});

test('review system prompt is three cacheable blocks ending with the persona', () => {
  const blocks = reviewSystemBlocks('brand-voice');
  assert.equal(blocks.length, 3);
  for (const b of blocks) {
    assert.equal(b.type, 'text');
    assert.deepEqual(b.cache_control, {type: 'ephemeral'});
  }
  assert.equal(blocks[0].text, conventions());
  assert.equal(blocks[1].text, reviewContract());
  assert.equal(blocks[2].text, getPersona('brand-voice').prompt);
});

test('the shared prefix is identical across personas so it caches', () => {
  const a = reviewSystemBlocks('end-user');
  const b = reviewSystemBlocks('system-admin');
  assert.equal(a[0].text, b[0].text);
  assert.equal(a[1].text, b[1].text);
  assert.notEqual(a[2].text, b[2].text);
});

test('an unknown persona id fails with the known ids listed', () => {
  assert.throws(() => getPersona('nope'), /Unknown persona "nope".*brand-voice/s);
});
