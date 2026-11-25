// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {Linter} from 'eslint';

import plugin from '../lint/index.mjs';

function lint(ruleName, code, parserOptions = {}) {
    const linter = new Linter();

    const messages = linter.verify(code, [
        {
            languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions},
            plugins: {'ui-surface': plugin},
            rules: {[`ui-surface/${ruleName}`]: 'error'},
        },
    ]);

    // Only the rule under test: ESLint's own unused-directive report would double-count disable comments.
    return messages.filter((message) => message.ruleId === `ui-surface/${ruleName}`);
}

test('syntactic ESLint rules catch bad patterns and pass clean specs', () => {
    assert.equal(lint('no-sleeps', 'await page.waitForTimeout(500);').length, 1);
    assert.equal(lint('no-sleeps', 'await page.waitForLoadState("networkidle");').length, 1);
    assert.equal(lint('no-sleeps', 'await page.waitForLoadState("domcontentloaded");').length, 0);

    assert.equal(lint('no-probes', 'const up = await btn.isVisible();').length, 1);
    assert.equal(lint('no-probes', 'await expect.poll(() => btn.isVisible()).toBe(true);').length, 0);

    assert.equal(lint('no-swallowed-catch', 'await x().catch(() => false);').length, 1);
    assert.equal(lint('no-swallowed-catch', 'try { await x(); } catch {}').length, 1);
    assert.equal(lint('no-swallowed-catch', 'try { await x(); } catch (e) { throw e; }').length, 0);

    assert.equal(lint('no-positional-picks', 'await row.first().click();').length, 1);
    assert.equal(lint('no-raw-css-locators', 'page.locator(".btn-primary").click();').length, 1);
    assert.equal(lint('no-raw-css-locators', 'page.getByTestId("channel_settings.save--button").click();').length, 0);

    assert.equal(lint('no-probes', 'const n = await rows.count();').length, 1);
    assert.equal(lint('no-probes', 'const v = await input.inputValue();').length, 1);
    assert.equal(lint('no-probes', 'await pw.waitUntil(async () => (await btn.textContent()) === "Save");').length, 0);
    assert.equal(lint('no-raw-css-locators', 'page.locator(`.btn-primary`);').length, 1);
    // eslint-disable-next-line no-template-curly-in-string
    assert.equal(lint('no-raw-css-locators', 'page.locator(`#post_${id}`);').length, 1);
    assert.equal(lint('no-raw-css-locators', 'page.locator("div.post-message");').length, 1);
    assert.equal(lint('no-raw-css-locators', 'page.locator("button");').length, 0);
});

test('observe-actions requires an observation between an action and leaving the page', () => {
    const body = (code) => lint('observe-actions', `async function t() {\n${code}\n}`);

    assert.equal(body('await btn.click();\nawait adminClient.getConfig();').length, 1);
    assert.equal(body('await btn.click();\nawait expect(panel).toBeVisible();').length, 0);
    assert.equal(body('await input.fill("x");\nawait save.click();\nawait expect(panel).toBeHidden();').length, 0);
    assert.equal(body('await input.fill("x");\nawait settings.save();\nawait expect(panel).toBeHidden();').length, 0);
    assert.equal(body('await btn.click();').length, 1);
    assert.equal(body('await settle(save, {wait: Api.PatchChannel}).click();').length, 0);
    assert.equal(
        body(
            'await pw.waitUntil(async () => { await refresh.click(); return (await status.textContent()) === "ok"; });',
        ).length,
        0,
    );
    assert.equal(body('await pw.waitUntil(async () => { await refresh.click(); return true; });').length, 1);
    assert.equal(body('await btn.click();\nawait test.step("next", async () => {});').length, 1);

    // Dataflow (gap 4): a trailing observation after a branch observes an action pending on any path.
    assert.equal(body('if (x) {\n  await btn.click();\n}\nawait expect(panel).toBeVisible();').length, 0);
    // Both branches act, nothing observes before the function ends -> both reported (join keeps both pending).
    assert.equal(body('if (x) {\n  await a.click();\n} else {\n  await b.click();\n}').length, 2);
    // An action in a loop, observed after the loop, is fine (loop may run; the expect joins the pending out).
    assert.equal(body('for (const r of rows) {\n  await r.click();\n}\nawait expect(panel).toBeVisible();').length, 0);
    // An action in a try, API call in finally -> the pending click turns away into the finally.
    assert.equal(body('try {\n  await btn.click();\n} finally {\n  await client.getConfig();\n}').length, 1);
    // Early return with a pending action is reported.
    assert.equal(body('await btn.click();\nif (x) {\n  return;\n}\nawait expect(panel).toBeVisible();').length, 1);
    assert.equal(body('await btn.click();\nawait modal.notToBeVisible();').length, 0);
    assert.equal(
        body(
            'await pw.loginPage.samlLoginButton.click();\nawait pw.keycloakLoginPage.login("u", "p");\nawait expect(home).toBeVisible();',
        ).length,
        0,
    );
    assert.equal(body('const done = page.waitForResponse(isSave);\nawait btn.click();\nawait done;').length, 0);
});

test('no-literal-absence flags absence checks on en.json copy, not on test data', () => {
    assert.equal(
        lint(
            'no-literal-absence',
            'await expect(modal.getByText("Channel names must have at least 1 character.")).not.toBeVisible();',
        ).length,
        1,
    );
    assert.equal(
        lint('no-literal-absence', 'await expect(page.getByRole("button", {name: "Save"})).toHaveCount(0);').length,
        1,
    );
    assert.equal(
        lint('no-literal-absence', 'await expect(page.getByText("RELIDO", {exact: true})).toHaveCount(0);').length,
        0,
    );
    const viaMsg = 'await expect(modal.getByText(Msg["channel_modal.name.longer"])).not.toBeVisible();';
    assert.equal(lint('no-literal-absence', viaMsg).length, 0);
    assert.equal(
        lint(
            'no-literal-absence',
            'await expect(modal.getByText("Channel names must have at least 1 character.")).toBeVisible();',
        ).length,
        0,
    );
});

test('no-floating-actions flags un-awaited actions and retrying assertions, not synchronous expects', () => {
    const wrap = (body) => `async function t() { ${body} }`;
    assert.equal(lint('no-floating-actions', wrap('btn.click();')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('void btn.click();')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('expect(await page.loginInput).toBeFocused();')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('expect(dialog).not.toBeVisible();')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('savePanel.save.toBeHidden();')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('expect.poll(() => n).toBe(2);')).length, 1);
    assert.equal(lint('no-floating-actions', wrap('await btn.click();')).length, 0);
    assert.equal(lint('no-floating-actions', wrap('expect(value).toBe(1);')).length, 0);
    assert.equal(lint('no-floating-actions', wrap('expect(list).toHaveLength(2);')).length, 0);
    assert.equal(lint('no-floating-actions', wrap('return btn.click();')).length, 0);
});

test('no-url-assertions flags path/relative toHaveURL, allows regex and absolute URLs', () => {
    const wrap = (body) => `async function t() { ${body} }`;
    assert.equal(lint('no-url-assertions', wrap('await expect(page).toHaveURL("/admin_console");')).length, 1);
    // eslint-disable-next-line no-template-curly-in-string
    assert.equal(lint('no-url-assertions', wrap('await expect(page).toHaveURL(`/team/${name}`);')).length, 1);
    assert.equal(lint('no-url-assertions', wrap('await expect(page).toHaveURL(/\\/admin_console/);')).length, 0);
    assert.equal(lint('no-url-assertions', wrap('await expect(page).toHaveURL("https://x.test/a");')).length, 0);
    assert.equal(lint('no-url-assertions', wrap('await expect(x).toHaveText("/a");')).length, 0);
});

test('no-soft-assertions, no-conditional-logic, no-locator-action and disable-reason', () => {
    const wrap = (body) => `async function t() { ${body} }`;
    assert.equal(lint('no-soft-assertions', wrap('await expect.soft(x).toBeVisible();')).length, 1);
    assert.equal(lint('no-soft-assertions', wrap('await expect(x).toBeVisible();')).length, 0);
    // Autofix drops `.soft`.
    const fixed = new Linter().verifyAndFix('async function t(){ await expect.soft(x).toBeVisible(); }', [
        {
            languageOptions: {ecmaVersion: 2022, sourceType: 'module'},
            plugins: {'ui-surface': plugin},
            rules: {'ui-surface/no-soft-assertions': 'error'},
        },
    ]);
    assert.match(fixed.output, /await expect\(x\)\.toBeVisible\(\)/);

    assert.equal(lint('no-conditional-logic', wrap('if (await btn.isVisible()) { await btn.click(); }')).length, 1);
    assert.equal(lint('no-conditional-logic', wrap('const n = (await rows.count()) > 1 ? 1 : 0;')).length, 1);
    assert.equal(lint('no-conditional-logic', wrap('if (process.env.CI) { await btn.click(); }')).length, 0);
    assert.equal(
        lint('no-conditional-logic', wrap('if (flag) { await pw.waitUntil(async () => await ok()); }')).length,
        0,
    );

    assert.equal(lint('no-locator-action', wrap('await savePanel.save.locator.click();')).length, 1);
    assert.equal(lint('no-locator-action', wrap('await savePanel.save.click();')).length, 0);
    assert.equal(lint('no-locator-action', wrap('await page.locator("x").click();')).length, 0);

    assert.equal(lint('disable-reason', '// eslint-disable-next-line\nfoo();').length, 1);
    assert.equal(lint('disable-reason', '// eslint-disable-next-line ui-surface/no-sleeps\nfoo();').length, 1);
    const withReason = '// eslint-disable-next-line ui-surface/no-sleeps -- animation has no event\nfoo();';
    assert.equal(lint('disable-reason', withReason).length, 0);
    assert.equal(lint('disable-reason', '// eslint-disable-next-line no-console\nfoo();').length, 0);
});
