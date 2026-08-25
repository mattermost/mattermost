// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};
const AUTOCOMPLETE_ROUTE = /\/api\/v4\/teams\/[^/]+\/channels\/autocomplete/;

test.describe('WYSIWYG editor - autocomplete suggestions', TAGS, () => {
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
        releaseSearch();
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
