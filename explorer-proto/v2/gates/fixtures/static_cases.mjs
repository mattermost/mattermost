// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Deliberately bad (and good) spec snippets for static_spec_check. `body` is inserted into an otherwise clean test;
// `source` is a whole file. `rules` is the exact set of rule ids the snippet must trip.

const HEADER = `import {expect, test} from '@mattermost/playwright-lib';

import {closeGuardedSessions, openGuardedSession} from '../src/session';

test.afterEach(closeGuardedSessions);
`;

export function wrap(body, {objective = true, after = true} = {}) {
    const doc = objective ? '/**\n * @objective Synthetic fixture.\n */\n' : '// plain comment\n';
    const tail = after ? '    await expect(info).toBeVisible(); // smoke: closing check\n' : '';
    return `${HEADER}
${doc}test('t', {tag: ['@x']}, async ({pw}) => {
    const {page, channelsPage} = await openGuardedSession(pw);
    const info = page.getByRole('region', {name: 'Info', exact: true});
${body
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n')}
${tail}});
`;
}

const soft = (text, marker = ' // soft-ok: seed-bound') =>
    `await expect.soft(info).toContainText('${text}'); // declared (c ${text})${marker}`;
const hard = () => 'await expect(info).toBeVisible(); // declared (c)';

export const BAD_CASES = [
    {rule: 'sleep-wait', name: 'page.waitForTimeout', body: 'await page.waitForTimeout(500);', rules: ['sleep-wait']},
    {
        rule: 'sleep-wait',
        name: 'setTimeout promise sleep',
        body: 'await new Promise((resolve) => setTimeout(resolve, 100));',
        rules: ['sleep-wait'],
    },
    {
        rule: 'sleep-wait',
        name: 'element access hides the name',
        body: "await page['waitForTimeout'](100);",
        rules: ['sleep-wait'],
    },
    {rule: 'soft-declared', name: 'expect.soft without soft-ok', body: soft('alpha', ''), rules: ['soft-declared']},
    {
        rule: 'soft-consecutive',
        name: 'four soft assertions in a row',
        body: ['a', 'b', 'c', 'd'].map((t) => soft(t)).join('\n'),
        rules: ['soft-consecutive'],
    },
    {
        rule: 'timeout-risk',
        name: 'six softs x 10 s plus a hard assertion exceed 60 s',
        body: [soft('a'), soft('b'), hard(), soft('c'), soft('d'), hard(), soft('e'), soft('f')].join('\n'),
        rules: ['timeout-risk'],
    },
    {
        rule: 'css-xpath-locator',
        name: '#id selector',
        body: "await expect(page.locator('#sidebar')).toBeVisible(); // smoke: x",
        rules: ['css-xpath-locator'],
    },
    {
        rule: 'css-xpath-locator',
        name: 'xpath locator',
        body: "await expect(page.locator('xpath=//div')).toBeVisible(); // smoke: x",
        rules: ['css-xpath-locator'],
    },
    {
        rule: 'css-xpath-locator',
        name: 'data-testid through locator instead of getByTestId',
        body: 'await expect(page.locator(\'[data-testid="x"]\')).toBeVisible(); // smoke: x',
        rules: ['css-xpath-locator'],
    },
    {
        rule: 'css-xpath-locator',
        name: 'querySelector in the page',
        body: "await page.$('.card');",
        rules: ['css-xpath-locator'],
    },
    {
        rule: 'get-by-text-presence',
        name: 'getByText substring on presence',
        body: "await expect(page.getByText('Hello')).toBeVisible(); // declared (c)",
        rules: ['get-by-text-presence'],
    },
    {
        rule: 'regex-presence',
        name: 'regex name on presence',
        body: "await expect(info.getByRole('button', {name: /Edit/})).toBeVisible(); // declared (c)",
        rules: ['regex-presence'],
    },
    {
        rule: 'regex-presence',
        name: 'regex getByText on presence',
        body: 'await expect(page.getByText(/Hello/)).toBeVisible(); // declared (c)',
        rules: ['regex-presence'],
    },
    {
        rule: 'presence-name-not-exact',
        name: 'role name without exact on presence',
        body: "await expect(info.getByRole('button', {name: 'Edit'})).toBeVisible(); // declared (c)",
        rules: ['presence-name-not-exact'],
    },
    {
        rule: 'action-not-role',
        name: 'click through getByTestId',
        body: "await page.getByTestId('x').click();",
        rules: ['action-not-role'],
    },
    {
        rule: 'action-not-role',
        name: 'fill through getByPlaceholder',
        body: "await page.getByPlaceholder('Write').fill('x');",
        rules: ['action-not-role'],
    },
    {
        rule: 'action-name-not-exact',
        name: 'click with a non-exact role name',
        body: "await page.getByRole('button', {name: 'Edit'}).click();",
        rules: ['action-name-not-exact'],
    },
    {
        rule: 'absence-exact-name',
        name: 'exact-name absence without a probe marker (lesson 1)',
        body: "await expect(info.getByRole('button', {name: 'Edit', exact: true})).toHaveCount(0); // declared (c)",
        rules: ['absence-exact-name'],
    },
    {
        rule: 'absence-exact-name',
        name: 'exact-name absence through toBeHidden',
        body: "await expect(info.getByText('Archived', {exact: true})).toBeHidden(); // declared (c)",
        rules: ['absence-exact-name'],
    },
    {
        rule: 'absence-exact-name',
        name: 'exact-name absence through not.toBeVisible',
        body: "await expect(info.getByRole('link', {name: 'Edit', exact: true})).not.toBeVisible(); // declared (c)",
        rules: ['absence-exact-name'],
    },
    {
        rule: 'unread-suffix',
        name: 'exact sidebar link name in a spec that posts (lesson 3)',
        body: "await channelsPage.createPost('hello');\nawait expect(page.getByRole('link', {name: 'town square public channel', exact: true})).toBeVisible(); // declared (c)",
        rules: ['unread-suffix'],
    },
    {rule: 'skip-fixme', name: 'test.skip inside a test', body: "test.skip(true, 'later');", rules: ['skip-fixme']},
    {rule: 'skip-fixme', name: 'test.fixme', body: 'test.fixme();', rules: ['skip-fixme']},
    {rule: 'skip-fixme', name: 'skipIfNoLicense', body: 'await pw.skipIfNoLicense();', rules: ['skip-fixme']},
    {rule: 'skip-fixme', name: 'element access hides test.skip', body: "test['skip']();", rules: ['skip-fixme']},
    {
        rule: 'test-only',
        name: 'test.only',
        source: `${HEADER}\n/**\n * @objective x\n */\ntest.only('t', async ({page}) => {\n    await expect(page.getByRole('button', {name: 'X', exact: true})).toBeVisible(); // smoke: x\n});\n`,
        rules: ['test-only'],
    },
    {
        rule: 'retries-config',
        name: 'describe.configure retries',
        source: `${HEADER}\ntest.describe.configure({retries: 2});\n\n/**\n * @objective x\n */\ntest('t', async ({page}) => {\n    await expect(page.getByRole('button', {name: 'X', exact: true})).toBeVisible(); // smoke: x\n});\n`,
        rules: ['retries-config'],
    },
    {
        rule: 'retries-config',
        name: 'test.use retries',
        source: `${HEADER}\ntest.use({retries: 1});\n\n/**\n * @objective x\n */\ntest('t', async ({page}) => {\n    await expect(page.getByRole('button', {name: 'X', exact: true})).toBeVisible(); // smoke: x\n});\n`,
        rules: ['retries-config'],
    },
    {
        rule: 'describe-parallel',
        name: 'parallel mode',
        source: `${HEADER}\ntest.describe.configure({mode: 'parallel'});\n\n/**\n * @objective x\n */\ntest('t', async ({page}) => {\n    await expect(page.getByRole('button', {name: 'X', exact: true})).toBeVisible(); // smoke: x\n});\n`,
        rules: ['describe-parallel'],
    },
    {
        rule: 'raw-url',
        name: 'goto with an origin and port',
        body: "await page.goto('http://127.0.0.1:8065/qa-team');",
        rules: ['raw-url'],
    },
    {
        rule: 'raw-url',
        name: 'localhost in a template string',
        body: 'const target = `localhost/path`;',
        rules: ['raw-url'],
    },
    {
        rule: 'raw-url',
        name: 'origin in a comment',
        body: '// see https://example.org/x for details',
        rules: ['raw-url'],
    },
    {
        rule: 'server-id',
        name: '26-character id in a string',
        body: "const channelId = 'a1b2c3d4e5f6g7h8i9j0k1l2m3';",
        rules: ['server-id'],
    },
    {
        rule: 'password-literal',
        name: 'password variable',
        body: "const password = 'Hunter2!pass';",
        rules: ['password-literal'],
    },
    {
        rule: 'password-literal',
        name: 'password property',
        body: "const login = {username: 'qa-user', password: 'Hunter2!pass'};",
        rules: ['password-literal'],
    },
    {
        rule: 'password-literal',
        name: 'bearer text',
        body: "const header = 'Bearer abcdef';",
        rules: ['password-literal'],
    },
    {rule: 'random-data', name: 'pw.random.post', body: 'const post = pw.random.post();', rules: ['random-data']},
    {
        rule: 'random-data',
        name: 'random channel name',
        // eslint-disable-next-line @stylistic/quotes
        body: `await pw.testBrowser.createPublicChannel(\`chan-\${Math.random()}\`);`,
        rules: ['random-data'],
    },
    {
        rule: 'random-data',
        name: 'initSetup creates random data',
        body: 'const setup = await pw.initSetup();',
        rules: ['random-data'],
    },
    {
        rule: 'missing-objective',
        name: 'no @objective comment',
        source: wrap('', {objective: false}),
        rules: ['missing-objective'],
    },
    {
        rule: 'no-trailing-assertion',
        name: 'last UI action is not followed by an assertion',
        source: wrap("await page.getByRole('button', {name: 'Close Info', exact: true}).click();", {after: false}),
        rules: ['no-trailing-assertion'],
    },
    {
        rule: 'label-missing',
        name: 'assertion without a label comment',
        body: 'await expect(info).toBeVisible();',
        rules: ['label-missing'],
    },
    {
        rule: 'label-missing',
        name: 'assertion with a free-form comment',
        body: 'await expect(info).toBeVisible(); // checks the panel',
        rules: ['label-missing'],
    },
    {
        rule: 'unawaited-assertion',
        name: 'missing await',
        body: 'expect(info).toBeVisible(); // smoke: x',
        rules: ['unawaited-assertion'],
    },
    {rule: 'parse-error', name: 'unbalanced braces', source: "test('x', async () => {\n", rules: ['parse-error']},
    {rule: 'no-tests', name: 'a file with no test', source: `${HEADER}\nexport const x = 1;\n`, rules: ['no-tests']},
];

export const GOOD_CASES = [
    {name: 'the clean skeleton', body: '', rules: []},
    {
        name: 'absence by regex name (substring) needs no marker',
        body: "await expect(info.getByRole('button', {name: /Add People/})).toHaveCount(0); // declared (c)",
    },
    {
        name: 'absence by non-exact string name needs no marker',
        body: "await expect(info.getByRole('button', {name: 'Add People'})).toHaveCount(0); // declared (c)",
    },
    {
        name: 'exact-name absence with a probe marker',
        body: "await expect(info.getByRole('button', {name: 'Edit', exact: true})).toHaveCount(0); // declared (c) // absence-verified: probe-7",
    },
    {
        name: 'text absence on a present region',
        body: "await expect(info).not.toContainText('Sandbox'); // declared (c)",
    },
    {
        name: 'presence by exact name with exact: true',
        body: "await expect(info.getByRole('button', {name: 'Edit', exact: true})).toBeVisible(); // declared (c)",
    },
    {
        name: 'presence by getByText exact',
        body: "await expect(info.getByText('Archived', {exact: true})).toBeVisible(); // declared (c)",
    },
    {
        name: 'getByTestId presence',
        body: "await expect(page.getByTestId('channel-bookmarks-container')).toBeVisible(); // declared (c)",
    },
    {
        name: 'role action with exact name',
        body: "await page.getByRole('button', {name: 'View Info', exact: true}).click();\nawait expect(info).toBeVisible(); // declared (c)",
    },
    {name: 'three soft assertions with soft-ok', body: [soft('a'), soft('b'), soft('c')].join('\n')},
    {
        name: 'many softs with short timeouts stay under the budget',
        body:
            ['a', 'b', 'c']
                .map(
                    (t) =>
                        `await expect.soft(info).toContainText('${t}', {timeout: 3000}); // declared (c) // soft-ok: seed-bound`,
                )
                .join('\n') +
            '\n' +
            hard() +
            '\n' +
            ['d', 'e', 'f']
                .map(
                    (t) =>
                        `await expect.soft(info).toContainText('${t}', {timeout: 3000}); // declared (c) // soft-ok: seed-bound`,
                )
                .join('\n'),
    },
    {
        name: 'post-creating spec with the unread suffix in the link name',
        body: "await channelsPage.createPost('hello');\nawait expect(page.getByRole('link', {name: 'town square public channel unread', exact: true})).toBeVisible(); // declared (c)",
    },
    {
        name: 'post-creating spec with an unread-ok marker',
        body: "await channelsPage.createPost('hello');\nawait expect(page.getByRole('link', {name: 'town square public channel', exact: true})).toBeVisible(); // declared (c) // unread-ok: checked read state",
    },
    {
        name: 'a non-sidebar link (thread list item) in a spec that posts is not subject to the unread suffix',
        body: "await channelsPage.createPost('hello');\nawait expect(page.getByRole('link', {name: 'Thread by Abe', exact: true})).toBeVisible(); // declared (c)",
    },
    {
        name: 'random helper with a random-ok marker',
        body: 'const post = pw.random.post(); // random-ok: charter allows a generated post',
    },
    {
        name: 'forbidden words only in comments and unrelated strings',
        body: "// never use waitForTimeout or test.skip or locator('#x') here\nconst label = 'test.skip is banned';",
    },
    {
        name: 'a path without an origin is fine',
        body: "await expect(page).toHaveURL((url) => url.pathname === '/qa-team/channels/qa-sandbox'); // declared (c)",
    },
    {name: 'a 25-character token is not a server id', body: "const note = 'abcdefghij0123456789abcde';"},
    {name: 'an empty password-like key is not a literal secret', body: "const token = '';"},
];

export const REAL_SPECS = [
    {
        file: 'real_pilot_01.spec.ts.txt',
        origin: 'explorer-proto/generated/pilot_01_mx_05.spec.ts',
        rules: ['soft-consecutive', 'soft-declared', 'timeout-risk'],
    },
    {
        file: 'real_pilot_02.spec.ts.txt',
        origin: 'explorer-proto/generated/pilot_02_mx_21.spec.ts',
        rules: ['absence-exact-name', 'soft-declared'],
    },
    {
        file: 'good_bookmarks.spec.ts.txt',
        origin: 'explorer-proto/sessions/bookmarks/generated/channels_bookmarks_bar_follows_switch.spec.ts',
        rules: [],
    },
];

export const JOURNEY_SPEC = {
    file: 'real_journey_auto_follow.spec.ts.txt',
    origin: 'e2e-tests/playwright/specs/functional/channels/notifications/channel_auto_follow_new_threads.spec.ts',
    rules: [
        'absence-exact-name',
        'get-by-text-presence',
        'label-missing',
        'random-data',
        'regex-presence',
        'unread-suffix',
    ],
};

export const CONFORMED_SPECS = ['conformed_pilot_01.spec.ts.txt', 'conformed_pilot_02.spec.ts.txt'];
