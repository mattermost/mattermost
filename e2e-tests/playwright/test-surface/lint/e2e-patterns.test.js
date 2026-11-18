// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

import {RuleTester} from 'eslint';

import {conditionalLogic, positionalPicks, probes, sleeps, softAssertions, swallowedCatch, urlAssertions} from './e2e-patterns.js';

const ruleTester = new RuleTester({languageOptions: {ecmaVersion: 2022, sourceType: 'module'}});
const fn = (code) => `async function f() {\n${code}\n}`;

ruleTester.run('e2e-no-probes', probes, {
    valid: [
        {code: fn('await expect(row).toBeVisible();')},
        {code: fn('await expect.poll(async () => (await row.isVisible()) || (await other.isVisible())).toBe(true);')},
        {code: fn('await expect(async () => { if (!(await row.isVisible())) { throw new Error("x"); } }).toPass();')},
        {code: fn('const ok = await helper.check();')},
    ],
    invalid: [
        {code: fn('const shown = await row.isVisible();'), errors: [{messageId: 'probe', data: {name: 'isVisible'}}]},
        {code: fn('const hidden = await row.locator.isHidden({timeout: 1000});'), errors: [{messageId: 'probe'}]},
        {code: fn('expect(await box.isChecked()).toBe(true);'), errors: [{messageId: 'probe'}]},
        {code: fn('await settle(row).click(); const on = await input.isEnabled();'), errors: [{messageId: 'probe'}]},
        {code: fn('const f2 = () => row.isEditable();'), errors: [{messageId: 'probe'}]},
    ],
});

ruleTester.run('e2e-no-conditional-logic', conditionalLogic, {
    valid: [
        {code: fn('if (flag) { await a.click(); }')},
        {code: fn('const x = cond ? 1 : 2;')},
        {code: fn('await expect(row).toBeVisible();')},
        {code: fn('const value = (await read()) || fallback;')},
        {code: fn('for (const item of items) { await item.click(); }')},
        {code: fn('const g = async () => { if (flag) { return 1; } };')},
        {code: fn('if (items.map(async () => await x).length) {}')},
    ],
    invalid: [
        {code: fn('if (await row.isVisible()) { await row.click(); }'), errors: [{messageId: 'conditional'}]},
        {code: fn('if (!(await row.count())) { return; }'), errors: [{messageId: 'conditional'}]},
        {code: fn('const x = (await read()) ? 1 : 2;'), errors: [{messageId: 'conditional'}]},
        {code: fn('while (await spinner.count()) { await wait(); }'), errors: [{messageId: 'conditional'}]},
        {code: fn('do { await next(); } while (await more());'), errors: [{messageId: 'conditional'}]},
        {code: fn('for (let i = 0; (await total()) > i; i++) {}'), errors: [{messageId: 'conditional'}]},
        {code: fn('flag && await expect(panel).toBeVisible();'), errors: [{messageId: 'conditional'}]},
        {code: fn('(await row.count()) || (await other.click());'), errors: [{messageId: 'conditional'}]},
    ],
});

ruleTester.run('e2e-no-swallowed-catch', swallowedCatch, {
    valid: [
        {code: fn('await work().catch((e) => { throw new Error(`more: ${e}`); });')},
        {code: fn('try { await work(); } catch (e) { expect(String(e)).toContain("x"); }')},
        {code: fn('try { await work(); } catch (e) { throw e; }')},
        {code: fn('await work().then(() => 1);')},
    ],
    invalid: [
        {code: fn('const shown = await row.isVisible().catch(() => false);'), errors: [{messageId: 'swallowed'}]},
        {code: fn('await cleanup().catch(() => undefined);'), errors: [{messageId: 'swallowed'}]},
        {code: fn('await cleanup().catch(function () {});'), errors: [{messageId: 'swallowed'}]},
        {code: fn('try { await work(); } catch {}'), errors: [{messageId: 'swallowed'}]},
        {code: fn('try { await work(); } catch (e) { return; }'), errors: [{messageId: 'swallowed'}]},
        {code: fn('try { await work(); } catch (e) { return false; }'), errors: [{messageId: 'swallowed'}]},
    ],
});

ruleTester.run('e2e-no-sleeps', sleeps, {
    valid: [
        {code: fn('test.setTimeout(120000); testInfo.setTimeout(5000);')},
        {code: fn('await page.waitForLoadState("load");')},
        {code: fn('await expect(row).toBeVisible();')},
        {code: fn('await page.waitForTimeoutLater(5);')},
    ],
    invalid: [
        {code: fn('await page.waitForTimeout(500);'), errors: [{messageId: 'timeout'}]},
        {code: fn('await page.waitForLoadState("networkidle");'), errors: [{messageId: 'networkidle'}]},
        {code: fn('await new Promise((resolve) => setTimeout(resolve, 100));'), errors: [{messageId: 'timer'}]},
        {code: fn('window.setTimeout(f, 1);'), errors: [{messageId: 'timer'}]},
        {code: fn('globalThis.setTimeout(f, 1);'), errors: [{messageId: 'timer'}]},
    ],
});

ruleTester.run('e2e-no-soft-assertions', softAssertions, {
    valid: [
        {code: fn('await expect(panel).toBeVisible();')},
        {code: fn('await expect.poll(() => 1).toBe(1);')},
        {code: fn('other.soft(1);')},
    ],
    invalid: [
        {code: fn('await expect.soft(panel).toBeVisible();'), errors: [{messageId: 'soft'}]},
    ],
});

ruleTester.run('e2e-no-url-assertions', urlAssertions, {
    valid: [
        {code: fn('await expect(app.loginPage).toBeOn();')},
        {code: fn('await expect(page).toHavePath("/login");')},
        {code: fn('await page.waitForURL("/x");')},
    ],
    invalid: [
        {code: fn('await expect(page).toHaveURL("/channels/town-square");'), errors: [{messageId: 'url'}]},
        {code: fn('await expect(page).toHaveURL(/\\/login/);'), errors: [{messageId: 'url'}]},
        {code: fn('await expect(page).not.toHaveURL(/\\/login/);'), errors: [{messageId: 'url'}]},
        {code: fn('await expect(app.page).toHaveURL(new RegExp(`/${team}/`));'), errors: [{messageId: 'url'}]},
    ],
});

ruleTester.run('e2e-no-positional-picks', positionalPicks, {
    valid: [
        {code: fn('await app.lhs.channelList.channel("town-square").click();')},
        {code: fn('const x = first(items); const y = _.first(items);')},
        {code: fn('const i = items.at(-1);')},
        {code: fn('const n = list.nth();')},
    ],
    invalid: [
        {code: fn('await rows.first().click();'), errors: [{messageId: 'position', data: {name: 'first'}}]},
        {code: fn('await rows.last().click();'), errors: [{messageId: 'position', data: {name: 'last'}}]},
        {code: fn('await rows.nth(2).click();'), errors: [{messageId: 'position', data: {name: 'nth'}}]},
        {code: fn('await expect(a.locator.getByRole("row").first()).toBeVisible();'), errors: [{messageId: 'position'}]},
    ],
});
