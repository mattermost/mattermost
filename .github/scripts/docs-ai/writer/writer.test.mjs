import {test} from 'node:test';
import assert from 'node:assert/strict';
import {additionsDiff} from '../lib/diff.mjs';
import {authorForPath, groupPathsByAuthor} from '../lib/personas.mjs';
import {
  assertVersionAnchors,
  hasVersionAnchor,
  parseFileBlocks,
  versionFromMilestone,
} from './files.mjs';
import {briefFromGapResult, briefFromPrEvidence, parseGapBrief} from './gap-brief.mjs';
import {DENY_PREFIXES, extractDocsPaths, isAllowedPath} from './paths.mjs';
import {sourcePrFrom} from './sync.mjs';
import {MARKER, buildComment, decide} from '../gap/gap.mjs';

test('allowlist accepts hand-authored content roots', () => {
  assert.equal(isAllowedPath('docs/main/administration-guide/foo.mdx'), true);
  assert.equal(isAllowedPath('docs/develop/contribute/bar.mdx'), true);
  assert.equal(isAllowedPath('docs/api/examples.mdx'), true);
  assert.equal(isAllowedPath('docs/api/index.mdx'), true);
});

test('deny list wins over allow prefixes', () => {
  for (const prefix of DENY_PREFIXES) {
    assert.equal(isAllowedPath(`${prefix}x.mdx`), false, prefix);
  }
  assert.equal(isAllowedPath('docs/api/reference/users.mdx'), false);
  assert.equal(isAllowedPath('docs/site/docusaurus.config.js'), false);
  assert.equal(isAllowedPath('../etc/passwd'), false);
});

test('extractDocsPaths pulls exact content paths from prose', () => {
  const text =
    'Update docs/main/administration-guide/configure/x.mdx and docs/api/examples.mdx; ignore docs/site/foo.';
  assert.deepEqual(extractDocsPaths(text).sort(), [
    'docs/api/examples.mdx',
    'docs/main/administration-guide/configure/x.mdx',
  ]);
});

test('versionFromMilestone reads vMAJOR.MINOR', () => {
  assert.equal(versionFromMilestone('v11.7.0'), 'v11.7');
  assert.equal(versionFromMilestone('Mattermost v10.12'), 'v10.12');
  assert.equal(versionFromMilestone('no version here'), null);
});

test('hasVersionAnchor accepts the convention or the human marker', () => {
  assert.equal(hasVersionAnchor('From Mattermost v11.7, users can…'), true);
  assert.equal(hasVersionAnchor('See [NOT PRESENT — REQUIRES HUMAN JUDGMENT].'), true);
  assert.equal(hasVersionAnchor('No version at all.'), false);
});

test('hasVersionAnchor requires the milestone version when supplied', () => {
  assert.equal(hasVersionAnchor('From Mattermost v9.5, legacy…', 'v11.7'), false);
  assert.equal(hasVersionAnchor('From Mattermost v11.7, new…', 'v11.7'), true);
  assert.equal(hasVersionAnchor('[NOT PRESENT — REQUIRES HUMAN JUDGMENT]', 'v11.7'), true);
});

test('assertVersionAnchors rejects capability pages without an anchor', () => {
  assert.throws(
    () =>
      assertVersionAnchors(
        [{path: 'docs/main/x.mdx', content: '---\ntitle: X\n---\n\nHello.\n'}],
        {milestoneVersion: 'v11.7'},
      ),
    /missing version anchor/,
  );
});

test('assertVersionAnchors rejects a stale anchor that is not the milestone', () => {
  assert.throws(
    () =>
      assertVersionAnchors(
        [{path: 'docs/main/x.mdx', content: '---\ntitle: X\n---\n\nFrom Mattermost v9.5, …\n'}],
        {milestoneVersion: 'v11.7'},
      ),
    /missing version anchor/,
  );
});

test('parseFileBlocks reads path= fences', () => {
  const text = [
    '```mdx path=docs/main/end-user-guide/a.mdx',
    '---',
    'title: A',
    '---',
    '',
    'From Mattermost v11.7, a.',
    '```',
    '',
    '```mdx path=docs/main/administration-guide/b.mdx',
    '---',
    'title: B',
    '---',
    '',
    'From Mattermost v11.7, b.',
    '```',
  ].join('\n');
  const files = parseFileBlocks(text);
  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'docs/main/end-user-guide/a.mdx');
  assert.match(files[1].content, /title: B/);
});

test('parseFileBlocks preserves nested three-backtick samples inside a longer fence', () => {
  const text = [
    '````mdx path=docs/main/administration-guide/example.mdx',
    '---',
    'title: Example',
    '---',
    '',
    'From Mattermost v11.7, run:',
    '',
    '```bash',
    'mmctl config get ServiceSettings.SiteURL',
    '```',
    '',
    'Done.',
    '````',
  ].join('\n');
  const files = parseFileBlocks(text);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'docs/main/administration-guide/example.mdx');
  assert.match(files[0].content, /```bash/);
  assert.match(files[0].content, /mmctl config get/);
  assert.match(files[0].content, /Done\./);
});

test('additionsDiff synthesises a reviewable unified diff', () => {
  const diff = additionsDiff([
    {path: 'docs/main/x.mdx', content: '---\ntitle: X\n---\n\nBody\n'},
  ]);
  assert.match(diff, /diff --git a\/docs\/main\/x\.mdx/);
  assert.match(diff, /\+---/);
  assert.match(diff, /\+Body/);
});

test('authorForPath reverse-looks up docs_paths', () => {
  assert.equal(authorForPath('docs/main/administration-guide/configure/x.mdx')?.id, 'system-admin');
  assert.equal(authorForPath('docs/main/end-user-guide/collaborate/y.mdx')?.id, 'end-user');
  assert.equal(authorForPath('docs/develop/api/foo.mdx')?.id, 'developer-dx');
  assert.equal(authorForPath('docs/main/unknown-section/x.mdx'), null);
});

test('groupPathsByAuthor batches by persona', () => {
  const groups = groupPathsByAuthor([
    'docs/main/administration-guide/a.mdx',
    'docs/main/deployment-guide/b.mdx',
    'docs/main/end-user-guide/c.mdx',
  ]);
  const byId = Object.fromEntries(groups.map((g) => [g.personaId, g.paths.length]));
  assert.equal(byId['system-admin'], 2);
  assert.equal(byId['end-user'], 1);
});

test('parseGapBrief recovers actions and paths from a sticky comment', () => {
  const comment = buildComment({
    result: {
      assessment: 'required',
      summary: 'Adds EnableFoo.',
      confidence: 'high',
      impacts: [
        {
          change: 'Config',
          files: 'config.go',
          audiences: 'Admin',
          action: 'Document',
          docsLocation: 'docs/main/administration-guide/configure/foo.mdx',
        },
      ],
      actions: ['Document EnableFoo in docs/main/administration-guide/configure/foo.mdx'],
    },
    decision: decide({assessment: 'required', labels: [], priorState: null}),
    sha: 'abc1234',
    runUrl: 'https://example.test/run',
  });

  assert.match(comment, new RegExp(MARKER));
  const brief = parseGapBrief(comment);
  assert.equal(brief.assessment, 'required');
  assert.equal(brief.actions.length, 1);
  assert.ok(brief.targetPaths.includes('docs/main/administration-guide/configure/foo.mdx'));
  assert.match(brief.summary, /EnableFoo/);
});

test('briefFromGapResult uses impact docs_location', () => {
  const brief = briefFromGapResult({
    assessment: 'recommended',
    summary: 's',
    actions: [],
    impacts: [{docs_location: 'docs/main/security-guide/x.mdx'}],
  });
  assert.deepEqual(brief.targetPaths, ['docs/main/security-guide/x.mdx']);
});

test('briefFromPrEvidence drafts from title/body when no sticky exists', () => {
  const brief = briefFromPrEvidence({
    prTitle: 'Add EnableFoo',
    prBody: 'See docs/main/administration-guide/configure/foo.mdx',
  });
  assert.equal(brief.assessment, 'required');
  assert.equal(brief.actions.length, 1);
  assert.ok(brief.targetPaths.includes('docs/main/administration-guide/configure/foo.mdx'));
  assert.match(brief.summary, /EnableFoo/);
});

test('sourcePrFrom reads branch and body marker', () => {
  assert.equal(sourcePrFrom({headRef: 'docs/pr-38177'}), '38177');
  assert.equal(sourcePrFrom({body: '<!-- docs-ai-source-pr:99 -->\nhello'}), '99');
  assert.equal(sourcePrFrom({explicit: '12', headRef: 'docs/pr-99'}), '12');
  assert.equal(sourcePrFrom({headRef: 'feature/x'}), null);
});
