// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ComboboxDriver} from '../src/aria/drivers';
import {expect} from '../src/aria/matchers';
import {settle} from '../src/aria/settle';

import {CreatePost, expect as playwrightExpect, json, test} from './serve';

// A searchable select: typing into its input filters the options, and each keystroke asks the server (as a
// server-side search does); choosing an option names it in the input.
const SELECT = `
<div data-testid="form.team--combobox">
    <input role="combobox" aria-controls="team-options" aria-expanded="false"
        oninput="filterOptions(this.value); fetch('/api/v4/posts', {method: 'POST', body: this.value})">
</div>
<ul id="team-options" role="listbox" hidden>
    <li role="option" onclick="pick(this)">Operations</li>
    <li role="option" onclick="pick(this)">Marketing</li>
    <li role="option" onclick="pick(this)">Opportunities</li>
</ul>
<script>
    const input = document.querySelector('input');
    const list = document.getElementById('team-options');
    function open() { list.hidden = false; input.setAttribute('aria-expanded', 'true'); }
    function filterOptions(text) {
        open();
        for (const o of list.children) o.hidden = !o.textContent.toLowerCase().includes(text.toLowerCase());
    }
    function pick(o) { input.value = o.textContent; list.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    input.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') open(); });
</script>`;

const team = (page: import('@playwright/test').Page) =>
    new ComboboxDriver(page.getByTestId('form.team--combobox'), {
        testId: 'form.team--combobox',
        role: 'combobox',
        source: 'TeamSelector',
    });

test.describe('combobox', () => {
    test('fill types into its input and filters the options; choose still works after it', async ({page, server}) => {
        await server.open(page, SELECT);
        const select = team(page);
        await select.fill('op');
        await expect(page.getByRole('option', {name: 'Operations'})).toBeVisible();
        await expect(page.getByRole('option', {name: 'Opportunities'})).toBeVisible();
        await expect(page.getByRole('option', {name: 'Marketing'})).toBeHidden();
        await select.choose('Operations');
        await expect(page.getByRole('combobox')).toHaveValue('Operations');
    });

    test('clear empties its input, and type filters a key at a time', async ({page, server}) => {
        await server.open(page, SELECT);
        const select = team(page);
        await select.fill('mark');
        await select.clear();
        await expect(page.getByRole('combobox')).toHaveValue('');
        await select.type('Mar');
        await expect(page.getByRole('option', {name: 'Marketing'})).toBeVisible();
        await expect(page.getByRole('option', {name: 'Operations'})).toBeHidden();
    });

    test('settle waits for the search a fill sends', async ({page, server}) => {
        server.handle((_, res, body) => json(res, {id: body}));
        await server.open(page, SELECT);
        playwrightExpect(await settle(team(page), {wait: CreatePost}).fill('Opera')).toEqual({id: 'Opera'});
    });
});
