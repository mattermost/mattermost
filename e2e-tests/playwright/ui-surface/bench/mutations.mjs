// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The head-to-head mutation battery. Each entry is a self-contained, minimal source sample carrying a mistake a real
// change could introduce. `level` picks the mechanism the harness uses to judge each tool (see run.mjs):
//   - 'spec'    : a Playwright spec snippet, judged by each tool's ESLint spec rules.
//   - 'webapp'  : a webapp .tsx snippet, judged by each tool's webapp-side check (lean scanner / ESLint; Peter webapp
//                 lint). Fast, no full program.
//   - 'scanner' : a webapp mistake only a program-wide scanner can see (cross-file, alias, custom component). Lean
//                 judges it with its single-file scanner; Peter needs his full ~5-minute program scan (bench:peter-scan).
//
// `expectCaught` is whether a correct tool SHOULD flag the sample. `clean: true` marks a companion sample that must NOT
// be flagged, so a tool that flags it is scored FALSE-POSITIVE.

/** @typedef {{id: string, category: string, level: 'spec'|'webapp'|'scanner', title: string, code: string, expectCaught: boolean, clean?: boolean}} Mutation */

const spec = (id, category, title, code, expectCaught = true) => ({
    id,
    category,
    level: 'spec',
    title,
    code,
    expectCaught,
});
const webapp = (id, category, title, code, expectCaught = true) => ({
    id,
    category,
    level: 'webapp',
    title,
    code,
    expectCaught,
});
const scanner = (id, category, title, code, expectCaught = true) => ({
    id,
    category,
    level: 'scanner',
    title,
    code,
    expectCaught,
});

/** @type {Mutation[]} */
export const mutations = [
    // ---- webapp: data-testid grammar and shape (data-testid is the attribute BOTH tools read) ----
    webapp(
        'dup-sibling-testid',
        'duplicate id',
        'Two sibling elements share one data-testid',
        [
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <button data-testid="panel.save--button">A</button>',
            '        <button data-testid="panel.save--button">B</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'dynamic-testid-grammar',
        'dynamic id',
        'Non-literal grammar data-testid value',
        [
            'export const C = ({name}: {name: string}) => (',
            '    <div data-surface="panel">',
            '        <button data-testid={`panel.${name}--button`}>Save</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'dynamic-testid',
        'ratchet',
        'Non-literal plain data-testid value (free-form legacy slips through unless ratcheted)',
        [
            'export const C = ({name}: {name: string}) => (',
            '    <div>',
            '        <button data-testid={name}>Save</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'ungrammatical-id',
        'grammar',
        'Ungrammatical id (scope.name but unknown role)',
        [
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <button data-testid="panel.save--frobnicate">Save</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'role-native-div',
        'role mismatch',
        'checkbox role on a plain <div>',
        [
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <div data-testid="panel.enabled--checkbox">x</div>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'new-legacy-testid',
        'ratchet',
        'A brand-new file adds a plain legacy data-testid with no surface counterpart',
        [
            'export const NewThing = () => (',
            '    <div>',
            '        <button data-testid="brand_new_legacy_button">Go</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'drift-disagree',
        'drift',
        'data-testid and data-surface on one element disagree',
        [
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <button data-surface="panel.save--button" data-testid="panel.cancel--button">Save</button>',
            '    </div>',
            ');',
        ].join('\n'),
    ),
    webapp(
        'clean-testid',
        'baseline',
        'A correct grammar id (data-surface container, grammar data-testid; must not be flagged)',
        [
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <button data-testid="panel.save--button">Save</button>',
            '    </div>',
            ');',
        ].join('\n'),
        false,
    ),

    // ---- scanner: program-wide / alias-sensitive webapp mistakes ----
    scanner(
        'key-array-index',
        'list key',
        'List key is the array map index',
        [
            'export const C = ({items}: {items: string[]}) => (',
            '    <ul data-surface="list">',
            '        {items.map((item, index) => (',
            '            <li key={index} data-testid={`list.row:${index}--listitem`}>{item}</li>',
            '        ))}',
            '    </ul>',
            ');',
        ].join('\n'),
    ),
    scanner(
        'key-display-name',
        'list key',
        'List key is display_name (locale/data dependent)',
        [
            'export const C = ({teams}: {teams: Array<{display_name: string}>}) => (',
            '    <ul data-surface="list">',
            '        {teams.map((t) => (',
            '            <li data-testid={`list.row:${t.display_name}--listitem`}>{t.display_name}</li>',
            '        ))}',
            '    </ul>',
            ');',
        ].join('\n'),
    ),
    scanner(
        'key-aliased-display',
        'list key',
        'List key aliased: const id = t.display_name',
        [
            'export const C = ({teams}: {teams: Array<{display_name: string}>}) => (',
            '    <ul data-surface="list">',
            '        {teams.map((t) => {',
            '            const id = t.display_name;',
            '            return <li data-testid={`list.row:${id}--listitem`}>{t.display_name}</li>;',
            '        })}',
            '    </ul>',
            ');',
        ].join('\n'),
    ),
    scanner(
        'key-composite',
        'list key',
        'List key is a composite string (team + channel)',
        [
            'export const C = ({rows}: {rows: Array<{teamId: string; channelId: string}>}) => (',
            '    <ul data-surface="list">',
            '        {rows.map((r) => (',
            '            <li data-testid={`list.row:${r.teamId + "_" + r.channelId}--listitem`}>x</li>',
            '        ))}',
            '    </ul>',
            ');',
        ].join('\n'),
    ),
    scanner(
        'key-identity-clean',
        'list key',
        'List key is an entity id via alias (must not be flagged)',
        [
            'export const C = ({teams}: {teams: Array<{id: string; display_name: string}>}) => (',
            '    <ul data-surface="list">',
            '        {teams.map((t) => {',
            '            const id = t.id;',
            '            return <li data-testid={`list.row:${id}--listitem`}>{t.display_name}</li>;',
            '        })}',
            '    </ul>',
            ');',
        ].join('\n'),
        false,
    ),
    scanner(
        'role-custom-component',
        'role mismatch',
        'checkbox kind on a custom <Toggle> that renders a switch',
        [
            "import {Toggle} from 'components/toggle';",
            'export const C = () => (',
            '    <div data-surface="panel">',
            '        <Toggle data-testid="panel.enabled--checkbox" />',
            '    </div>',
            ');',
        ].join('\n'),
    ),

    // ---- spec: flake / observability lint ----
    spec(
        'unobserved-click',
        'observability',
        'Unobserved click before an API call',
        [
            'test("x", async ({page, pw}) => {',
            '    await page.getByTestId("panel.save--button").click();',
            '    await pw.client.getConfig();',
            '});',
        ].join('\n'),
    ),
    spec(
        'sleep',
        'flake',
        'waitForTimeout sleep',
        ['test("x", async ({page}) => {', '    await page.waitForTimeout(1000);', '});'].join('\n'),
    ),
    spec(
        'raw-css',
        'locator',
        'Raw CSS locator',
        ['test("x", async ({page}) => {', '    await page.locator(".btn-primary").click();', '});'].join('\n'),
    ),
    spec(
        'floating-action',
        'flake',
        'Floating (un-awaited) action',
        [
            'test("x", async ({page}) => {',
            '    page.getByTestId("panel.save--button").click();',
            '    await expect(page.getByTestId("panel")).toBeVisible();',
            '});',
        ].join('\n'),
    ),
    spec(
        'conditional-on-state',
        'flake',
        'Conditional on awaited page state',
        [
            'test("x", async ({page}) => {',
            '    if (await page.getByTestId("panel").isVisible()) {',
            '        await page.getByTestId("panel.save--button").click();',
            '    }',
            '});',
        ].join('\n'),
    ),
    spec(
        'soft-assertion',
        'flake',
        'expect.soft()',
        [
            'test("x", async ({page}) => {',
            '    await expect.soft(page.getByTestId("panel")).toBeVisible();',
            '});',
        ].join('\n'),
    ),
    spec(
        'url-assertion',
        'flake',
        'toHaveURL("/path") drops server subpath',
        ['test("x", async ({page}) => {', '    await expect(page).toHaveURL("/admin_console");', '});'].join('\n'),
    ),
    spec(
        'positional-pick',
        'locator',
        'Positional .first() pick',
        [
            'test("x", async ({page}) => {',
            '    await page.getByTestId("list.row").first().click();',
            '    await expect(page.getByTestId("panel")).toBeVisible();',
            '});',
        ].join('\n'),
    ),
    spec(
        'disable-no-reason',
        'hygiene',
        'Bare eslint-disable with no rule/reason',
        [
            'test("x", async ({page}) => {',
            '    // eslint-disable-next-line',
            '    await page.waitForTimeout(100);',
            '});',
        ].join('\n'),
    ),
    spec(
        'clean-spec',
        'baseline',
        'A correct observed interaction (must not be flagged)',
        [
            'test("x", async ({page, pw}) => {',
            '    await page.getByTestId("panel.save--button").click();',
            '    await expect(page.getByTestId("panel")).toBeVisible();',
            '});',
        ].join('\n'),
        false,
    ),
];
