// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {Linter} from 'eslint';

import plugin from '../lint/index.mjs';

function lint(ruleName, code, parserOptions = {}) {
    const linter = new Linter();
    return linter.verify(code, [
        {
            languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions},
            plugins: {'ui-surface': plugin},
            rules: {[`ui-surface/${ruleName}`]: 'error'},
        },
    ]);
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
    assert.equal(body('if (x) {\n  await btn.click();\n}\nawait expect(panel).toBeVisible();').length, 1);
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
