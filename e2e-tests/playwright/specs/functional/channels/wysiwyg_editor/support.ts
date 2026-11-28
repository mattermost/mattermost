// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    Api,
    expect,
    settle,
    setWysiwygUserPreference,
    type App,
    type PlaywrightExtended,
} from '@mattermost/playwright-lib';

/**
 * The rich-text (WYSIWYG) composer on the generated page objects. It is the same composer as the Markdown one
 * (`<host>.post_create`): its message box is the editable area, with the formatting bar's buttons keyed by format and
 * the same suggestion list. What the editor renders inside the box (bold, headings, mentions) is its document, read
 * as HTML.
 */

export type Composer = App['center']['postCreate'] | App['rhs']['postCreate'];

/** The blockquote inside a message or the editor: rendered markdown and editor documents give no id to their elements. */
export function blockquoteIn(part: {locator: Locator}): Locator {
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- a blockquote is plain rendered HTML and cannot take an id
    return part.locator.locator('blockquote');
}

/** Turns on the user's rich-text preference, logs them in and opens the team's off-topic channel. */
export async function openRichComposer(
    pw: PlaywrightExtended,
    setup: {user: UserProfile; userClient: Parameters<typeof setWysiwygUserPreference>[0]; team: Team},
) {
    await setWysiwygUserPreference(setup.userClient, setup.user.id, true);
    const {app} = await pw.testBrowser.login(setup.user);
    await app.channelsPage.goto({team: setup.team, channel: 'off-topic'});
    await expectRich(app.center.postCreate);
    return app;
}

/** The composer's message box is the rich-text editor (an editable area, not a textarea). */
export async function expectRich(composer: Composer) {
    await expect(composer.message.container).toHaveAttribute('contenteditable', 'true');
    await expect(composer.message.container).toHaveAttribute('role', 'textbox');
}

/** Types like a user: the editor needs a transaction per keystroke, so not fill(). */
export async function typeRich(composer: Composer, text: string) {
    await composer.message.container.focus();
    await composer.message.container.type(text);
    await expect(composer.message.container).toBeFocused();
}

/** Selects everything in the editor and deletes it. */
export async function clearRich(composer: Composer) {
    await composer.message.container.focus();
    await composer.message.container.press('ControlOrMeta+a', 'Delete');
    await expect(composer.message.container).toHaveText('');
}

/** Pastes `text` into the editor as a clipboard paste event. */
export async function pasteRich(composer: Composer, text: string) {
    await composer.message.container.focus();
    await expect(composer.message.container).toBeFocused();
    await composer.message.container.locator.evaluate((el, data) => {
        const transfer = new DataTransfer();
        transfer.setData('text/plain', data);
        el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: transfer, bubbles: true, cancelable: true}));
    }, text);
}

/** Waits until the editor's document matches `pattern` (or, with `not`, stops matching it). */
export async function expectDocument(composer: Composer, pattern: RegExp, not = false) {
    const html = () => composer.message.container.locator.innerHTML();
    if (not) {
        await expect.poll(html).not.toMatch(pattern);
    } else {
        await expect.poll(html).toMatch(pattern);
    }
}

/** Sends with the Send button, once the draft is ready, and waits for the editor to empty. */
export async function sendRich(composer: Composer) {
    await expect(composer.sendButton).toBeEnabled();
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
    await expect(composer.message.container).toHaveText('');
}

/** The text of a post list's last post, once there is one. */
export async function lastPostText(list: App['center']['postList'] | App['rhs']['thread']) {
    const id = (await list.postList.keys()).at(-1);
    return id ? list.post({id}).message.container.text() : '';
}
