// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};
const AUTOCOMPLETE_ROUTE = /\/api\/v4\/teams\/[^/]+\/channels\/autocomplete/;

// The on-screen box of the character immediately before the caret, which is the trigger that opened the list.
function triggerRect(editor: WysiwygEditor) {
    return editor.input.evaluate((element) => {
        const selection = element.ownerDocument.getSelection()!;
        const range = element.ownerDocument.createRange();
        range.setStart(selection.focusNode!, selection.focusOffset - 1);
        range.setEnd(selection.focusNode!, selection.focusOffset);

        const {left, top} = range.getBoundingClientRect();
        return {left, top};
    });
}

test.describe('WYSIWYG editor - autocomplete suggestions', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    test('slash command autocomplete opens and completes on Enter', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('/away');

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Enter');
        await expect(editor.input).toContainText('/away');
    });

    test('@mention autocomplete opens for team members and navigates with Arrow keys', async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);
        const created = await adminClient.createUser(await pw.random.user(), '', '');
        await adminClient.addToTeam(team.id, created.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(`@${created.username}`);

        const list = editor.suggestionList();
        await expect(list).toBeVisible();
        // ArrowDown then ArrowUp: proves keyboard navigation cycles the list.
        await editor.press('ArrowDown');
        await editor.press('ArrowUp');
        // Click the specific entry: which item is highlighted after search settles
        // is order-dependent (recency, username collisions), so avoid pressing Enter.
        await list.getByText(created.username, {exact: false}).first().click();
        await expect(editor.input).toContainText(`@${created.username}`);
    });

    test('~channel autocomplete opens and completes', async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);
        const linked = await adminClient.createPublicChannel(team.id, 'Wysiwyg Target');
        await adminClient.addToChannel(user.id, linked.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(`~${linked.name.slice(0, 5)}`);

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Enter');
        await expect(editor.input).toContainText(`~${linked.name}`);
    });

    /**
     * @objective Verify that WYSIWYG channel autocomplete renders the channels already known locally while a search
     * for more channels is still in flight.
     *
     * The post_textbox equivalent goes on to verify that the search response is merged into what is already
     * rendered. The WYSIWYG editor never applies that response — the searched group keeps its loading indicator
     * indefinitely — so this test asserts only what the editor does today.
     */
    test('~channel autocomplete shows local results while a search is in flight', async ({pw}) => {
        const {adminClient, user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const localChannel = await adminClient.createPublicChannel(team.id, 'AC Z WYSIWYG Local', 'ac-wysiwyg-local');
        await adminClient.addToChannel(user.id, localChannel.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        let releaseSearch!: () => void;
        const searchReleased = new Promise<void>((resolve) => {
            releaseSearch = resolve;
        });
        await page.route(AUTOCOMPLETE_ROUTE, async (route) => {
            await searchReleased;
            await route.continue();
        });

        await editor.type('~ac-');

        const list = editor.suggestionList();
        const myChannels = list.getByRole('group', {name: 'My Channels'});
        const otherChannels = list.getByRole('group', {name: 'Other Channels'});

        // * Verify the local public result is visible while the server response is still pending
        await expect(myChannels.getByRole('option')).toContainText(['AC Z WYSIWYG Local']);

        // * Verify the group of channels being searched for shows that it is still loading
        await expect(otherChannels.getByTestId('loadingSpinner')).toBeVisible();

        // # Let the held search finish so it isn't left blocked when the test ends
        const searchResponse = page.waitForResponse((response) => AUTOCOMPLETE_ROUTE.test(response.url()));
        releaseSearch();
        await searchResponse;
    });

    /**
     * @objective Verify that the WYSIWYG autocomplete opens under the character that triggered it rather than in
     * the top left corner of the composer.
     *
     * @reference MM-70333
     */
    test('~channel autocomplete opens under the trigger character', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        // # Type enough text that the trigger character is nowhere near the left edge of the composer
        await editor.type('lorem ipsum dolor sit amet ~');
        await expect(editor.suggestionList()).toBeVisible();

        const inputBox = (await editor.input.boundingBox())!;
        const listBox = (await editor.suggestionList().boundingBox())!;
        const trigger = await triggerRect(editor);

        // * Verify the trigger character really is far from the left edge, so the assertions below mean something
        expect(trigger.left - inputBox.x).toBeGreaterThan(100);

        // * Verify the list opens a channel-name indent (39px) to the left of the trigger, so the names line up
        // under it. The band is tight enough to fail if the caret were measured instead of the trigger.
        expect(trigger.left - listBox.x).toBeGreaterThan(35);
        expect(trigger.left - listBox.x).toBeLessThan(44);

        // * Verify the list is still fully inside the composer
        expect(listBox.x + listBox.width).toBeLessThanOrEqual(inputBox.x + inputBox.width + 1);
    });

    /**
     * @objective Verify that the WYSIWYG autocomplete sits above the line holding the trigger character rather
     * than above the whole composer once the message has wrapped.
     *
     * @reference MM-70333
     */
    test('~channel autocomplete follows the trigger onto a wrapped line', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        const singleLineHeight = (await editor.input.boundingBox())!.height;

        // # Fill the composer so that it has wrapped by the time the trigger character is typed
        await editor.type(`${'lorem ipsum '.repeat(15)}~`);
        await expect(editor.suggestionList()).toBeVisible();

        const inputBox = (await editor.input.boundingBox())!;
        const listBox = (await editor.suggestionList().boundingBox())!;
        const trigger = await triggerRect(editor);

        // * Verify the composer really did wrap, so the assertion below means something
        expect(inputBox.height).toBeGreaterThan(singleLineHeight + 10);

        // * Verify the bottom of the list rests on the line the trigger is on, not on the top of the composer
        expect(Math.abs(listBox.y + listBox.height - trigger.top)).toBeLessThanOrEqual(4);
    });

    test('emoji shortcode autocomplete opens and closes on Escape', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type(':smi');

        await expect(editor.suggestionList()).toBeVisible();
        await editor.press('Escape');
        await expect(editor.suggestionList()).not.toBeVisible();
    });
});
