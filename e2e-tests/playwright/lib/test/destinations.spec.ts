// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DestinationError} from '../src/aria/destinations';
import {expect} from '../src/aria/matchers';

import {AboutPage, ChannelPage, composer} from './fixture';
import {button, expect as playwrightExpect, test, unexpected} from './serve';

/** A delete button that shows the dialog, counting its clicks in `window.clicks`. */
const dialogPage = (shown = false) =>
    [
        '<script>window.clicks = 0;</script>',
        button(
            'composer.delete--button',
            "window.clicks++; setTimeout(() => { document.getElementById('dialog').hidden = false; }, 100)",
            'Delete',
        ),
        `<div id="dialog" ${shown ? '' : 'hidden'} data-testid="composer.delete_dialog--dialog">`,
        button('composer.delete_dialog.confirm--button', '', 'Confirm'),
        '</div>',
        '<input data-testid="composer.message--textbox" onkeydown="window.keys = (window.keys || []).concat(event.key); if (event.key === \'Enter\') document.getElementById(\'dialog\').hidden = false">',
    ].join('');

const clicks = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as {clicks: number}).clicks);

test.describe('clickTo', () => {
    test('clicks, waits for the scope and returns it, typed as it was passed', async ({page, server}) => {
        await server.open(page, dialogPage());
        const app = composer(page);
        const destination = app.deleteDialog;
        const dialog = await app.deleteButton.clickTo(destination);
        playwrightExpect(dialog).toBe(destination);
        await expect(dialog).toBeVisible();
    });

    test('an element is a destination too', async ({page, server}) => {
        await server.open(page, dialogPage());
        const app = composer(page);
        const confirm = await app.deleteButton.clickTo(app.deleteDialog.confirmButton);
        await expect(confirm).toBeVisible();
    });

    test('fails at once, without clicking, when the destination is already visible', async ({page, server}) => {
        await server.open(page, dialogPage(true));
        const app = composer(page);
        const started = Date.now();
        const error = await app.deleteButton.clickTo(app.deleteDialog).then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error).toBeInstanceOf(DestinationError);
        playwrightExpect(error.message).toContain(
            '"composer.delete_dialog" (Dialog) was already visible before clicking on "composer.delete--button" (Composer)',
        );
        playwrightExpect(Date.now() - started).toBeLessThan(1_000);
        playwrightExpect(await clicks(page)).toBe(0);
    });

    test('fails at its deadline when the destination never shows, naming both', async ({page, server}) => {
        await server.open(page, dialogPage() + button('composer.save--button', '', 'Save'));
        const app = composer(page);
        const error = await app.saveButton
            .clickTo(app.deleteDialog, {timeout: 500})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error).toBeInstanceOf(DestinationError);
        playwrightExpect(error.message).toContain(
            'clicking on "composer.save--button" (Composer) did not show "composer.delete_dialog" (Dialog) within 500 ms',
        );
    });

    test('a part its mount never renders is not a destination', async ({page, server}) => {
        await server.open(page, dialogPage());
        const app = composer(page);
        const notRendered = app.deleteDialog.rememberCheckbox as unknown as import('../src/aria/drivers').Destination;
        const error = await app.deleteButton.clickTo(notRendered).then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain('the destination is not a scope or an element');
        playwrightExpect(await clicks(page)).toBe(0);
    });
});

test.describe('clickTo a page', () => {
    /** A link that navigates in the page (pushState), then renders the page's ready element; or, with `bounce`, moves on. */
    const linkPage = (opts: {ready?: boolean; bounce?: boolean} = {}) =>
        [
            '<div id="view"></div>',
            button(
                'composer.save--button',
                `history.pushState({}, '', '/channels/town'); ${
                    opts.bounce ? "setTimeout(() => history.pushState({}, '', '/elsewhere'), 50);" : ''
                } ${
                    opts.ready === false
                        ? ''
                        : "setTimeout(() => { document.getElementById('view').innerHTML = '<p data-testid=\\'channel.view\\'>Town</p>'; }, 200);"
                }`,
                'Go',
            ),
        ].join('');

    test('waits for the path and a ready element, and returns the page', async ({page, server}) => {
        await server.open(page, linkPage());
        const channel = new ChannelPage(page);
        const reached = await composer(page).saveButton.clickTo(channel, {channel: 'town'});
        playwrightExpect(reached).toBe(channel);
        await expect(page).toHavePath('/channels/town');
    });

    test('a path that matched before a redirect, with the ready element later, does not pass', async ({
        page,
        server,
    }) => {
        await server.open(page, linkPage({bounce: true}));
        const error = await composer(page)
            .saveButton.clickTo(new ChannelPage(page), {channel: 'town'}, {timeout: 1_000})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error).toBeInstanceOf(DestinationError);
        playwrightExpect(error.message).toContain('did not reach ChannelPage (/channels/town) within 1000 ms');
        playwrightExpect(error.message).toContain('the page is at /elsewhere');
    });

    test('fails at once when the page is already at that path', async ({page, server}) => {
        await server.open(page, linkPage());
        await page.evaluate(() => history.pushState({}, '', '/channels/town'));
        const error = await composer(page)
            .saveButton.clickTo(new ChannelPage(page), {channel: 'town'})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain('the page was already at /channels/town (ChannelPage) before it');
    });

    test('a page with no ready element is refused', async ({page, server}) => {
        await server.open(page, linkPage());
        const about = new AboutPage(page) as unknown as ChannelPage;
        const error = await composer(page)
            .saveButton.clickTo(about, {channel: 'x'})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain('AboutPage has no ready element to wait for');
    });
});

test.describe('pressTo and press', () => {
    test('pressTo presses one key and arrives, with clickTo’s contract', async ({page, server}) => {
        await server.open(page, dialogPage());
        const app = composer(page);
        const dialog = await app.messageTextbox.pressTo('Enter', app.deleteDialog);
        await expect(dialog).toBeVisible();
    });

    test('pressTo fails at once when the destination is already visible', async ({page, server}) => {
        await server.open(page, dialogPage(true));
        const app = composer(page);
        const error = await app.messageTextbox
            .pressTo('Enter', app.deleteDialog)
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain(
            'was already visible before pressing Enter on "composer.message--textbox"',
        );
        playwrightExpect(await page.evaluate(() => (window as unknown as {keys?: string[]}).keys)).toBeUndefined();
    });

    test('a key sequence is one press: the element is focused once, the keys go in order', async ({page, server}) => {
        await server.open(page, dialogPage());
        await composer(page).messageTextbox.press('ArrowDown', 'ArrowDown', 'a');
        playwrightExpect(await page.evaluate(() => (window as unknown as {keys: string[]}).keys)).toEqual([
            'ArrowDown',
            'ArrowDown',
            'a',
        ]);
    });
});

test.describe('file inputs', () => {
    test('chooseFiles sets the files on the input', async ({page, server}, testInfo) => {
        await server.open(page, '<input type="file" multiple data-testid="composer.attach">');
        const file = testInfo.outputPath('c.txt');
        (await import('node:fs')).writeFileSync(file, 'c');
        const attach = composer(page).attach;
        playwrightExpect(attach.meta).toEqual({testId: 'composer.attach', role: null, source: 'Composer'});
        await attach.chooseFiles(file);
        playwrightExpect(
            await page.getByTestId('composer.attach').evaluate((el) => (el as HTMLInputElement).files?.[0]?.name),
        ).toBe('c.txt');
    });
});

test.describe('not.toHavePath', () => {
    const at = (path: string, then = '') => `<script>history.pushState({}, '', '${path}'); ${then}</script>`;

    test('waits until the page has left the path', async ({page, server}) => {
        await server.open(
            page,
            at('/channels/town', "setTimeout(() => history.pushState({}, '', '/elsewhere'), 300);"),
        );
        const started = Date.now();
        await expect(page).not.toHavePath('/channels/town', {timeout: 3_000});
        playwrightExpect(Date.now() - started).toBeLessThan(2_500);
        await expect(page).toHavePath('/elsewhere');
    });

    test('passes at once for a path the page is not at', async ({page, server}) => {
        await server.open(page, at('/channels/town'));
        const started = Date.now();
        await expect(page).not.toHavePath('/elsewhere', {timeout: 3_000});
        playwrightExpect(Date.now() - started).toBeLessThan(1_500);
    });

    test('fails, naming the path, when the page stays on it', async ({page, server}) => {
        await server.open(page, at('/channels/town'));
        const error = await expect(page)
            .not.toHavePath('/channels/town', {timeout: 500})
            .then(unexpected, (e: unknown) => e as Error);
        playwrightExpect(error.message).toContain(
            'Expected page not to be at path /channels/town, but it stayed there',
        );
    });
});
