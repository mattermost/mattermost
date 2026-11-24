// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import {test} from 'node:test';

import {Linter} from 'eslint';

import plugin from '../lint/index.mjs';

function lint(ruleName, code, parserOptions = {}) {
    const linter = new Linter();
    return linter.verify(code, [{
        languageOptions: {ecmaVersion: 2022, sourceType: 'module', parserOptions},
        plugins: {'ui-surface': plugin},
        rules: {[`ui-surface/${ruleName}`]: 'error'},
    }]);
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

    assert.equal(lint('testid-grammar', 'const a = <button data-testid="bad--nope" />;', {ecmaFeatures: {jsx: true}}).length, 1);
    assert.equal(lint('testid-grammar', 'const b = <button data-testid="channel_settings.save--button" />;', {ecmaFeatures: {jsx: true}}).length, 0);
});
