// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {describe, it} from 'node:test';

import {RuleTester} from 'eslint';

import lessons from './lessons.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({languageOptions: {ecmaVersion: 'latest', sourceType: 'module'}});

const inAsync = (body) => `async function run(loc) { ${body} }`;

ruleTester.run('no-unwaited-is-visible', lessons.rules['no-unwaited-is-visible'], {
    valid: [
        'await expect(loc).toBeVisible();',
        'const visible = await loc.isVisible();',
        'for (let i = 0; i < 3; i++) { await loc.isVisible(); }',
        'for (await loc.isVisible(); ; ) { break; }',
        'for (let i = 0; i < 3; await loc.isVisible()) { i++; }',
        'while (true) { await loc.isVisible(); break; }',
        'if (ready) { await loc.isVisible(); }',
        'ready && (await loc.isVisible());',
        'const visible = (await loc.isVisible()) && ready;',
        'for (; ; (await loc.isVisible()) && (await loc.click())) { break; }',
    ].map(inAsync),
    invalid: [
        'await loc.isVisible().catch(() => false);',
        'if (await loc.isVisible()) {}',
        'if (!(await loc.isVisible()) && ready) {}',
        'if ((await loc.isVisible()) === true) {}',
        'const x = (await loc.isVisible()) ? 1 : 2;',
        'while (await loc.isVisible()) {}',
        'do {} while (await loc.isVisible());',
        'for (; await loc.isVisible(); ) {}',
        'for (let i = 0; ready && (await loc.isVisible()); i++) {}',
        '(await loc.isVisible()) && (await loc.click());',
        '!(await loc.isVisible()) || (await loc.click());',
        '(ready || (await loc.isVisible())) && (await loc.click());',
        'for (let i = 0; i < 3; i++) { (await loc.isVisible()) && (await loc.click()); }',
    ].map((body) => ({code: inAsync(body), errors: 1})),
});

ruleTester.run('no-page-state-branch', lessons.rules['no-page-state-branch'], {
    valid: [
        'const n = await loc.count();',
        'await expect(loc).toHaveCount(2);',
        'if (await loc.isVisible()) {}',
        'for (let i = 0; i < 3; i++) { await loc.count(); }',
        'for (let i = await loc.count(); i > 0; i--) {}',
        'for (let i = 0; i < 3; i += await loc.count()) {}',
        'for (const item of await loc.all()) { await item.click(); }',
        'for (const key in await loc.getAttribute("data")) {}',
        'while (ready) { await loc.count(); }',
        'if (ready) { await loc.count(); }',
        'ready && (await loc.count());',
        'const empty = (await loc.count()) === 0 && ready;',
        'await loc.textContent() ?? recover();',
    ].map(inAsync),
    invalid: [
        {code: inAsync('if ((await loc.count()) === 0) {}'), method: 'count'},
        {code: inAsync('if (await loc.isChecked()) {}'), method: 'isChecked'},
        {code: inAsync('const x = (await loc.textContent()) === "a" ? 1 : 2;'), method: 'textContent'},
        {code: inAsync('while ((await loc.inputValue()) !== "") {}'), method: 'inputValue'},
        {code: inAsync('do {} while (await loc.isEnabled());'), method: 'isEnabled'},
        {code: inAsync('for (let i = 0; i < (await loc.count()); i++) {}'), method: 'count'},
        {code: inAsync('for (; !(await loc.isHidden()); ) {}'), method: 'isHidden'},
        {code: inAsync('(await loc.count()) === 0 && (await recover());'), method: 'count'},
        {code: inAsync('(await loc.isChecked()) || (await loc.check());'), method: 'isChecked'},
    ].map(({code, method}) => ({code, errors: [{messageId: 'branch', data: {method}}]})),
});
