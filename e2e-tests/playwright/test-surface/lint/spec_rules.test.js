// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The spec rules, case by case. Each case is a function body checked with the types of test/fixtures/lint_actions.
import path from 'node:path';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

import typescriptParser from '@typescript-eslint/parser';
import {RuleTester} from 'eslint';

import disableReason from './e2e-disable-reason.js';
import noFloatingActions from './e2e-no-floating-actions.js';
import noLocatorAction from './e2e-no-locator-action.js';
import observeActions from './e2e-observe-actions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test/fixtures/lint_actions');

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
    languageOptions: {
        parser: typescriptParser,
        parserOptions: {project: './tsconfig.json', tsconfigRootDir: root},
    },
});

const IMPORTS = "import {Api, app, expect, helper, page, settle, waitForApi} from './runtime';\n";
const filename = path.join(root, 'spec.ts');

/** The same body with `settle` imported under another name. */
const aliased = (code, errors) => ({code: `import {Api, app, expect, helper, page, settle as hold} from './runtime';\nexport async function f() {\n${code}\n}`, filename, ...(errors ? {errors} : {})});

/** The same body with the runtime imported as a namespace. */
const namespaced = (code, errors) => ({code: `import * as runtime from './runtime';\nimport {Api, app, expect, helper, page} from './runtime';\nexport async function f() {\n${code}\n}`, filename, ...(errors ? {errors} : {})});

/** A function of the spec's own that is named `settle`: not the runtime's. */
const LOCAL_SETTLE = "import {app} from './runtime';\nfunction settle(target: unknown) {\nreturn {click: async () => target};\n}\n";

/** The same body with a helper of another module that is named `settle` but is not the runtime's. */
const fake = (code, errors) => ({code: `import {settle as fakeSettle} from './fake_settle';\nimport {Api, app, expect, helper, page} from './runtime';\nexport async function f() {\n${code}\n}`, filename, ...(errors ? {errors} : {})});

/** A case: the body of an async function. */
const body = (code, errors) => ({code: `${IMPORTS}export async function f(flag: boolean, items: string[]) {\n${code}\n}`, filename, ...(errors ? {errors} : {})});

ruleTester.run('e2e-observe-actions', observeActions, {
    valid: [

        // an observation between actions
        body('await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); await app.sidebar.channel("a").click(); await expect(app.sidebar).toBeVisible();'),
        body('await app.settings.saveButton.click(); await expect(app.settings.panel).not.toBeVisible();'),
        body('await app.settings.saveButton.click(); await expect.poll(() => 1).toBe(1);'),
        body('await app.settings.saveButton.click(); await expect(async () => {}).toPass();'),

        // preparing actions are batched
        body('await app.settings.nameTextbox.fill("a"); await app.settings.nameTextbox.clear(); await app.settings.nameTextbox.type("b"); await app.settings.saveButton.hover(); await app.settings.saveButton.focus(); await settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),

        // settle, clickTo and pressTo observe themselves
        body('await settle(app.settings.saveButton, {wait: Api.CreatePost}).click(); await settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),
        body('await app.post("p").menuButton.clickTo(app.postMenu); await app.postMenu.deleteMenuItem.clickTo(app.post("p").deleteModal); await helper(page);'),
        body('await app.settings.nameTextbox.pressTo("Enter", app.postMenu); await helper(page);'),

        // the accepted composition
        body('await Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]); await helper(page);'),
        body('await Promise.all([waitForApi(page, Api.CreatePost), page.waitForEvent("popup"), app.settings.saveButton.clickTo(app.postMenu)]); await helper(page);'),

        // queries and synchronous assertions in between are not actions
        body('const name = app.settings.saveButton.locator; expect(name).toBeTruthy(); await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible();'),

        // a callback is its own function
        body('await expect(async () => { await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); }).toPass(); await helper(page);'),

        // receivers that are not drivers or Playwright objects
        body('const map = new Map<string, string>(); map.set("a", "b"); map.clear(); await helper(page); [1].fill(0); await helper(page);'),
        body('const erased: any = app.settings.saveButton; await erased.click(); await helper(page);'),

        // a part behind a binding is still its driver
        body('await app.settings.notifyButton.click(); await expect(app.settings.panel).toBeVisible();'),

        // paths that all observe
        body('await app.settings.saveButton.click(); if (flag) { await expect(app.settings.panel).toBeVisible(); } else { await expect(app.sidebar).toBeVisible(); } await app.sidebar.channel("a").click(); await expect(app.sidebar).toBeVisible();'),
        body('for (const item of items) { await app.sidebar.channel(item).click(); await expect(app.sidebar).toBeVisible(); } await helper(page);'),
        body('try { await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); } catch { await expect(app.sidebar).toBeVisible(); } await helper(page);'),
        body('switch (items[0]) { case "a": await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); break; default: break; } await helper(page);'),

        // an action that throws ends its path
        body('await app.settings.saveButton.click(); throw new Error("x");'),

        // a finally that only observes
        body('try { await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); } finally { await expect(app.sidebar).toBeVisible(); } await helper(page);'),

        // a finally continues the normal exit: on a throw the function fails after it, so cleanup there is no turning away
        body('try { await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); } finally { await helper(page); }'),
        body('try { await app.settings.saveButton.click(); throw new Error("x"); } finally { await helper(page); }'),

        // settle under another name still observes itself
        aliased('await hold(app.settings.saveButton, {wait: Api.CreatePost}).click(); await hold(app.settings.saveButton, {wait: Api.CreatePost}).click();'),

        // settle through a const alias still observes itself
        body('const hold = settle; await hold(app.settings.saveButton, {wait: Api.CreatePost}).click(); await hold(app.settings.saveButton, {wait: Api.CreatePost}).click();'),

        // settle through a namespace import still observes itself
        namespaced('await runtime.settle(app.settings.saveButton, {wait: Api.CreatePost}).click(); await runtime.settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),

        // a returned composition is the caller's to await
        body('return Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);'),

        // actions in a chain need no observation between them: Playwright waits for the target of each
        body('await app.settings.saveButton.click(); await app.sidebar.channel("a").click(); await expect(app.sidebar).toBeVisible();'),
        body('await page.keyboard.press("Enter"); await page.keyboard.press("Enter"); await expect(app.sidebar).toBeVisible();'),
        body('await app.settings.saveButton.locator.click(); await app.postMenu.deleteMenuItem.click(); await expect(app.sidebar).toBeVisible();'),
        body('await app.settings.tab("info").select(); await app.settings.saveButton.click(); await expect(app.sidebar).toBeVisible();'),
        body('await app.settings.nameTextbox.blur(); await app.settings.saveButton.click(); await expect(app.sidebar).toBeVisible();'),
        body('await app.post("p").menuButton.click(); await app.postMenu.deleteMenuItem.click(); await expect(app.post("p").deleteModal).toBeVisible();'),
        body('await app.postMenu.deleteMenuItem.click(); await app.post("p").deleteModal.confirmButton.click(); await expect(app.sidebar).toBeVisible();'),
        body('await app.settings.saveButton.click(); await app.sidebar.channel("a").click(); await app.sidebar.channel("b").click(); await expect(app.sidebar).toBeVisible();'),
        body('for (const item of items) { await app.sidebar.channel(item).click(); } await expect(app.sidebar).toBeVisible();'),

        // an observed action ends a chain that comes before it
        body('await app.settings.saveButton.click(); await settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),
        body('await app.settings.saveButton.click(); await Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);'),
        body('await app.settings.saveButton.click(); await app.post("p").menuButton.clickTo(app.postMenu);'),

        // a path that skips the observation of an earlier action is chained into the next action
        body('await app.settings.saveButton.click(); if (flag) { await expect(app.settings.panel).toBeVisible(); } await app.sidebar.channel("a").click(); await expect(app.sidebar).toBeVisible();'),

        // a disable silences one report and keeps the state: a later chained action absorbs it
        body('await app.settings.saveButton.click();\n// eslint-disable-next-line rule-to-test/e2e-observe-actions -- under test\nawait helper(page);\nawait app.sidebar.channel("a").click(); await expect(app.sidebar).toBeVisible();'),
    ],
    invalid: [

        // the last action of a chain is still the one that must be observed
        body('await app.settings.saveButton.click(); await app.sidebar.channel("a").click();', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click(); await app.sidebar.channel("a").click(); await helper(page);', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click(); await settle(app.settings.saveButton, {wait: Api.CreatePost}).click(); await app.sidebar.channel("a").click(); await helper(page);', [{messageId: 'away'}]),

        // rule 2: turning away
        body('await app.settings.saveButton.click(); await helper(page);', [{messageId: 'away'}]),
        body('await app.settings.nameTextbox.fill("a"); await page.goto("/");', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click();', [{messageId: 'away'}]),
        body('await app.settings.nameTextbox.fill("a"); return;', [{messageId: 'away'}]),
        {code: `${IMPORTS}export const f = () => app.settings.saveButton.click();`, filename, errors: [{messageId: 'away'}]},
        body('return app.settings.saveButton.click();', [{messageId: 'away'}]),

        // not observations
        body('await app.settings.saveButton.click(); expect(await app.settings.panel.locator.isVisible()).toBe(true);', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click(); expect(app.settings.panel).toBeVisible(); await helper(page);', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click(); await expect.soft(app.settings.panel).toBeVisible(); await helper(page);', [{messageId: 'away'}]),

        // paths join by "pending on any path"

        body('await app.settings.saveButton.click(); if (flag) { await expect(app.settings.panel).toBeVisible(); } await helper(page);', [{messageId: 'away'}]),
        body('await app.settings.saveButton.click(); flag && await expect(app.settings.panel).toBeVisible(); await helper(page);', [{messageId: 'away'}]),

        // a loop body that may run zero times supplies no observation
        body('await app.settings.saveButton.click(); for (const item of items) { await expect(app.sidebar.channel(item)).toBeVisible(); } await helper(page);', [{messageId: 'away'}]),
        body('while (flag) { await app.sidebar.channel("a").click(); if (flag) { break; } await expect(app.sidebar).toBeVisible(); } await helper(page);', [{messageId: 'away'}]),

        // try/catch: an observation inside try does not clear the catch edge
        body('try { await app.settings.saveButton.click(); await expect(app.settings.panel).toBeVisible(); } catch { await helper(page); }', [{messageId: 'away'}]),

        // another module's settle that returns the driver is no settle: its click is an ordinary, unobserved one
        fake('await fakeSettle(app.settings.saveButton).click();', [{messageId: 'away'}]),

        // a finally that returns swallows the throw: what the throw left pending is checked there
        body('try { await app.settings.saveButton.click(); if (flag) { throw new Error("x"); } await expect(app.settings.panel).toBeVisible(); } finally { return; }', [{messageId: 'away'}]),
        body('try { await helper(page); } catch { await app.settings.saveButton.click(); throw new Error("x"); } finally { return; }', [{messageId: 'away'}]),

        // a composition that is not awaited observes nothing
        body('Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]); await helper(page);', [{messageId: 'away'}]),

        // switch fall-through
        body('switch (items[0]) { case "a": await app.settings.saveButton.click(); case "b": await helper(page); break; default: break; }', [{messageId: 'away'}]),

        // continue skips the observation of its iteration
        body('for (const item of items) { await app.sidebar.channel(item).click(); if (flag) { continue; } await expect(app.sidebar).toBeVisible(); } await helper(page);', [{messageId: 'away'}]),

        // rule 2 reports an action once, at its first boundary
        body('await app.settings.saveButton.click(); await helper(page); await helper(page); return;', [{messageId: 'away', line: 3}]),

        // unsupported forms
        body('await Promise.race([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]); await expect(app.sidebar).toBeVisible();', [{messageId: 'unsupported'}]),
        body('await Promise.all([app.settings.saveButton.click(), waitForApi(page, Api.CreatePost)]); await expect(app.sidebar).toBeVisible();', [{messageId: 'unsupported'}]),
        body('await app.settings.saveButton.click().then(() => 1); await expect(app.sidebar).toBeVisible();', [{messageId: 'unsupported'}]),
        body('const button = app.settings.saveButton; await button["click"](); await expect(app.sidebar).toBeVisible();', [{messageId: 'unsupported'}]),
        body('const click = app.settings.saveButton.click; await helper(page); void click;', [{messageId: 'unsupported'}]),
    ],
});

ruleTester.run('e2e-no-floating-actions', noFloatingActions, {
    valid: [
        body('await app.settings.saveButton.click();'),
        body('await settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),
        body('await Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);'),
        body('await expect(app.settings.panel).toBeVisible();'),
        body('await expect.poll(() => 1).toBe(1);'),
        body('expect(1).toBe(1); expect(items).toEqual([]);'),
        body('return app.settings.saveButton.click();'),
        {code: `${IMPORTS}export const f = () => app.settings.saveButton.click();`, filename},
        body('const map = new Map<string, string>(); map.set("a", "b"); [1].fill(0);'),
        body('return Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);'),
        aliased('await hold(app.settings.saveButton, {wait: Api.CreatePost}).click();'),
        namespaced('await runtime.settle(app.settings.saveButton, {wait: Api.CreatePost}).click();'),

        // a local function named settle is not the runtime's: neither an action nor a detached settle
        {code: `${LOCAL_SETTLE}export async function f() {\nsettle(app.settings.saveButton).click();\nconst held = settle(app.settings.saveButton);\nawait held.click();\n}`, filename},

        // a project type named like a Playwright receiver is not one
        {code: "import {keyboard} from './local_types';\nexport async function f() {\nkeyboard.press('a');\n}", filename},
    ],
    invalid: [
        body('app.settings.saveButton.click();', [{messageId: 'action'}]),
        body('void app.settings.saveButton.click();', [{messageId: 'action'}]),
        body('page.keyboard.press("Enter");', [{messageId: 'action'}]),
        body('settle(app.settings.saveButton, {wait: Api.CreatePost}).click();', [{messageId: 'action'}]),
        body('expect(app.settings.panel).toBeVisible();', [{messageId: 'assertion'}]),
        body('expect.poll(() => 1).toBe(1);', [{messageId: 'assertion'}]),
        body('expect(async () => {}).toPass();', [{messageId: 'assertion'}]),
        body('const pending = app.settings.saveButton.click(); await pending;', [{messageId: 'action'}]),
        body('await Promise.race([app.settings.saveButton.click()]);', [{messageId: 'action'}]),

        // the accepted composition is handled only when it is itself awaited or returned
        body('Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);', [{messageId: 'action'}]),
        body('void Promise.all([waitForApi(page, Api.CreatePost), app.settings.saveButton.click()]);', [{messageId: 'action'}]),

        // a settle stored, or with its verb read off, hides the action
        body('const saving = settle(app.settings.saveButton, {wait: Api.CreatePost}); await saving.click();', [{messageId: 'settled'}]),
        body('const click = settle(app.settings.saveButton, {wait: Api.CreatePost}).click; await click();', [{messageId: 'settled'}]),
        body('await helper(settle(app.settings.saveButton, {wait: Api.CreatePost}) as never);', [{messageId: 'settled'}]),

        // settle under another name is still an action
        aliased('hold(app.settings.saveButton, {wait: Api.CreatePost}).click();', [{messageId: 'action'}]),

        // another module's settle is no settle: its click is a driver action like any other, and storing it is not a settle
        fake('fakeSettle(app.settings.saveButton).click();', [{messageId: 'action'}]),

        // and through a const alias of the function, called on the spot or stored
        body('const hold = settle; hold(app.settings.saveButton, {wait: Api.CreatePost}).click();', [{messageId: 'action'}]),
        body('const hold = settle; const saving = hold(app.settings.saveButton, {wait: Api.CreatePost}); await saving.click();', [{messageId: 'settled'}]),

        // and through a namespace import, called on the spot or stored
        namespaced('runtime.settle(app.settings.saveButton, {wait: Api.CreatePost}).click();', [{messageId: 'action'}]),
        namespaced('const saving = runtime.settle(app.settings.saveButton, {wait: Api.CreatePost}); await saving.click();', [{messageId: 'settled'}]),
    ],
});

ruleTester.run('e2e-no-locator-action', noLocatorAction, {
    valid: [
        body('await app.settings.saveButton.click();'),
        body('await expect(app.settings.saveButton.locator).toBeVisible();'),
        body('await page.locator("x").click();'),

        // a scope is no driver: its locator is the only way to act on it
        body('await app.settings.panel.locator.hover();'),

        // a driver without the verb: a text driver has no click, a button no fill
        body('await app.settings.titleText.locator.click();'),
        body('await app.settings.saveButton.locator.fill("a");'),

        // Playwright options: only click takes them, so another action with options stays on the locator
        body('await app.settings.titleText.locator.hover({force: true});'),

        // a click with options needs a driver click: a tab's select() takes none
        body('await app.settings.tab("info").locator.click({button: "right"});'),

        // reads are not actions
        body('const box = await app.settings.saveButton.locator.boundingBox(); void box;'),
        body('const text = await app.settings.saveButton.locator.toString(); void text;'),
    ],
    invalid: [
        body('await app.settings.saveButton.locator.click();', [{message: 'Act through the driver: `app.settings.saveButton.click(…)`, not `app.settings.saveButton.locator.click(…)`.'}]),
        body('await app.settings.nameTextbox.locator.fill("a");', [{message: /nameTextbox\.fill/}]),
        body('await app.settings.nameTextbox.locator.pressSequentially("a");', [{message: /nameTextbox\.type/}]),
        body('await app.settings.tab("info").locator.click();', [{message: /tab\("info"\)\.select/}]),
        body('await app.sidebar.channel("a").locator.click();', [{message: /channel\("a"\)\.click/}]),
        body('await app.settings.titleText.locator.hover();', [{message: /titleText\.hover/}]),
        body('await app.settings.notifyButton.locator.focus();', [{message: /notifyButton\.focus/}]),
        body('await app.settings.saveButton.locator.click({button: "right"});', [{message: 'Act through the driver: `app.settings.saveButton.click(…)`, not `app.settings.saveButton.locator.click(…)`.'}]),
        body('await app.sidebar.channel("a").locator.click({modifiers: ["Alt"]});', [{message: /channel\("a"\)\.click/}]),
    ],
});

// The guarded rules exist here as no-ops, so the directives under test resolve.
const noop = {create: () => ({})};
new RuleTester({
    plugins: {'test-surface': {rules: {'e2e-observe-actions': noop, 'e2e-no-floating-actions': noop, 'e2e-no-literal-locators': noop, 'e2e-no-url-assertions': noop}}},
    linterOptions: {reportUnusedDisableDirectives: 'off'},
}).run('e2e-disable-reason', disableReason, {
    valid: [
        {code: '// eslint-disable-next-line test-surface/e2e-observe-actions -- the menu closes itself\nf();'},
        {code: '/* eslint-disable test-surface/e2e-no-floating-actions -- fire and forget by design */'},
        {code: '// eslint-disable-next-line test-surface/e2e-no-literal-locators -- the role and name are the subject of this check\nf();'},
        {code: '// eslint-disable-next-line test-surface/e2e-no-url-assertions -- the redirect target is the subject\nf();'},
        {code: '// eslint-disable-next-line no-console\nf();'},
        {code: '// a comment about eslint-disable\nf();'},
    ],
    invalid: [
        {code: '// eslint-disable-next-line test-surface/e2e-observe-actions\nf();', errors: [{messageId: 'reason'}]},
        {code: 'f(); /* eslint-disable-line test-surface/e2e-no-floating-actions -- */', errors: [{messageId: 'reason'}]},
        {code: '/* eslint-disable no-console, test-surface/e2e-observe-actions */', errors: [{messageId: 'reason'}]},
        {code: '// eslint-disable-next-line test-surface/e2e-no-literal-locators\nf();', errors: [{messageId: 'reason'}]},
        {code: '// eslint-disable-next-line test-surface/e2e-no-url-assertions\nf();', errors: [{messageId: 'reason'}]},
        {code: '// eslint-disable-next-line\nf();', errors: [{messageId: 'unnamed'}]},
    ],
});
