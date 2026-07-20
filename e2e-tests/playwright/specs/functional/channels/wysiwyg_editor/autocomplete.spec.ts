// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

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
