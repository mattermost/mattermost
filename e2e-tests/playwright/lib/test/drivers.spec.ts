// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '../src/aria/matchers';
import {formatMessage, msg} from '../src/aria/msg';
import {keyOf} from '../src/aria/scope';
import {settle} from '../src/aria/settle';

import {PatchChannel, button, expect as playwrightExpect, json, test, unexpected} from './serve';
import {composer, Dialog} from './fixture';

const OPEN_DIALOG = "document.getElementById('dialog').hidden = false";

const PAGE = [
    button('composer.delete--button', OPEN_DIALOG, 'Delete'),
    '<div id="dialog" hidden data-testid="composer.delete_dialog--dialog">',
    button('composer.delete_dialog.confirm--button', "fetch('/api/v4/channels/c1/patch', {method: 'PUT'})", 'Confirm'),
    '</div>',
    '<ul>',
    '<li data-testid="composer.row:plain"><span data-testid="composer.row.title--text">Plain</span></li>',
    '<li data-testid="composer.row:com.mattermost.calls"><span data-testid="composer.row.title--text">Calls</span></li>',
    '<li data-testid="composer.row:a:b--c"><span data-testid="composer.row.title--text">Odd</span></li>',
    '<li data-testid="composer.row.nested:x">not a row</li>',
    '</ul>',
].join('');

test.describe('drivers', () => {
    test('a plain action resolves to nothing: the spec says where it leads', async ({page, server}) => {
        server.handle((_, res) => json(res, {id: 'c1'}));
        await server.open(page, PAGE);
        playwrightExpect(await composer(page).deleteButton.click()).toBeUndefined();
        const dialog = composer(page).deleteDialog;
        playwrightExpect(dialog).toBeInstanceOf(Dialog);
        await expect(dialog).toBeVisible();
        playwrightExpect(await settle(dialog.confirmButton, {wait: PatchChannel}).click()).toEqual({id: 'c1'});
    });

    test('a part its mount never renders is NotRendered at run time too', async ({page, server}) => {
        await server.open(page, PAGE);
        playwrightExpect(composer(page).deleteDialog.rememberCheckbox).toEqual({notRendered: true});
        playwrightExpect(composer(page).hiddenButton).toEqual({notRendered: true});
    });

    test("text, a group and a container are clicked through their drivers, with Playwright's options", async ({
        page,
        server,
    }) => {
        await server.open(
            page,
            [
                '<script>window.clicks = [];',
                "document.addEventListener('mousedown', (e) => clicks.push(",
                "[e.target.closest('[data-testid]').dataset.testid, e.button, e.altKey].join(' ')));</script>",
                '<ul><li data-testid="composer.row:plain" style="padding: 8px">',
                '<span data-testid="composer.row.title--text">Plain</span>',
                `<div role="group" data-testid="composer.row.options--group" onclick="${OPEN_DIALOG}">Options</div>`,
                '</li></ul>',
                '<div id="dialog" hidden data-testid="composer.delete_dialog--dialog">Delete?</div>',
            ].join(''),
        );
        const row = composer(page).row('plain');
        await row.titleText.click({button: 'right'});
        await row.container.click({modifiers: ['Alt'], position: {x: 2, y: 2}});
        playwrightExpect(await row.optionsGroup.text()).toBe('Options');
        const dialog = await row.optionsGroup.clickTo(composer(page).deleteDialog);
        playwrightExpect(dialog).toBeInstanceOf(Dialog);
        await expect(dialog).toBeVisible();
        playwrightExpect(await page.evaluate(() => (window as unknown as {clicks: string[]}).clicks)).toEqual([
            'composer.row.title--text 2 false',
            'composer.row:plain 0 true',
            'composer.row.options--group 0 false',
        ]);
    });

    test('a keyed child is found by its key, whatever characters it holds, and its members inside it', async ({
        page,
        server,
    }) => {
        await server.open(page, PAGE);
        const app = composer(page);
        await expect(app.row('com.mattermost.calls').titleText).toHaveText('Calls');
        await expect(app.row('a:b--c').titleText).toHaveText('Odd');
        playwrightExpect(await app.row('plain').titleText.text()).toBe('Plain');
    });

    test('a keyed list reads its keys exactly, and only its own items', async ({page, server}) => {
        await server.open(page, PAGE);
        const rows = composer(page).rowList;
        playwrightExpect(rows.label).toBe('composer.row:{key}');
        playwrightExpect(await rows.keys()).toEqual(['plain', 'com.mattermost.calls', 'a:b--c']);
        await expect(rows).toHaveKeys(['plain', 'com.mattermost.calls', 'a:b--c']);
        await expect(rows).toContainKeys(['a:b--c']);
        await expect(rows).toHaveKeyCount(3);
        await expect(rows).not.toContainKeys(['x']);
        playwrightExpect(await rows.keyWith({text: 'Calls'})).toBe('com.mattermost.calls');
        await expect((await rows.last()).titleText).toHaveText('Odd');
    });

    test('expect takes drivers and scopes, and a failure names the element and its component', async ({
        page,
        server,
    }) => {
        await server.open(page, PAGE);
        const app = composer(page);
        await expect(app.deleteButton).toBeEnabled();
        await expect(app.deleteButton).not.toBePressed();
        const error = await expect(app.deleteButton)
            .toBeDisabled({timeout: 200})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain('  element: composer.delete--button (Composer)');
        const notError = await expect(app.deleteButton)
            .not.toBeVisible({timeout: 200})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(notError.message).toContain('  element: composer.delete--button (Composer)');
    });

    test('a failure names the component the generated code passes, and the item that failed', async ({
        page,
        server,
    }) => {
        await server.open(page, PAGE);
        const app = composer(page);
        const label = await expect(app.labelText)
            .toBeVisible({timeout: 200})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(label.message).toContain('  element: composer.label--text (SaveLabel)');
        const row = await expect(app.row('plain').container)
            .toBeHidden({timeout: 200})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(row.message).toContain('  element: composer.row:plain (Item)');
    });

    test('an index-keyed list reads its keys as numbers', async ({page, server}) => {
        await server.open(page, '<p data-testid="composer.slot:0">a</p><p data-testid="composer.slot:1">b</p>');
        const keys = await composer(page).slotList.keys();
        playwrightExpect(keys).toEqual([0, 1]);
        playwrightExpect(keys[1] + 1).toBe(2);
    });

    test('an id that is all digits stays a string', async ({page, server}) => {
        await server.open(page, '<li data-testid="composer.row:123">x</li>');
        playwrightExpect(await composer(page).rowList.keys()).toEqual(['123']);
    });

    test('expect still asserts on anything else', async ({page, server}) => {
        await server.open(page, PAGE);
        expect(1 + 1).toBe(2);
        await expect(page.getByTestId('composer.delete--button')).toHaveText('Delete');
        await expect.soft(composer(page).deleteButton).toHaveText('Delete');
        await expect.poll(() => 3).toBe(3);
    });
});

test.describe('formatMessage', () => {
    test('formats ICU messages as the webapp does', () => {
        playwrightExpect(
            formatMessage(
                msg<{count: number}>('x.count', '{count, plural, =0 {No posts} one {# post} other {# posts}}'),
                {count: 1200},
            ),
        ).toBe('1,200 posts');
        playwrightExpect(
            formatMessage(
                msg<{count: number}>('x.count', '{count, plural, =0 {No posts} one {# post} other {# posts}}'),
                {count: 0},
            ),
        ).toBe('No posts');
        playwrightExpect(
            formatMessage(
                msg<{kind: string}>('x.kind', '{kind, select, public {Public channel} other {Private channel}}'),
                {kind: 'public'},
            ),
        ).toBe('Public channel');
        playwrightExpect(
            formatMessage(msg<{name: string}>('x.rich', '<b>{name}</b> joined **the channel**'), {name: 'sam'}),
        ).toBe('sam joined the channel');
        playwrightExpect(formatMessage(msg('x.quote', "It''s done"))).toBe("It's done");
    });

    test('a missing value names the message', () => {
        playwrightExpect(() => formatMessage(msg<{name: string}>('x.name', 'Hello {name}'))).toThrow(/x\.name/);
    });
});

test('keyOf: an entity or its key', () => {
    playwrightExpect(keyOf<{id: string}, 'id'>({id: 'abc'}, 'id')).toBe('abc');
    playwrightExpect(keyOf<{id: string}, 'id'>('abc', 'id')).toBe('abc');
});
