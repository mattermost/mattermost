// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should send ephemeral post with Update and Delete actions via /ephemeral command', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Navigate to Town Square — avoids noise from demo plugin's own ephemeral messages
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Send /ephemeral command. sendDemoSlashCommand waits for the command's network
    // response, so the retry below only fires on a genuine UI timing miss.
    const ephemeralPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'test ephemeral actions'})
        .last();
    for (let attempt = 0; attempt < 3; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/ephemeral');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(ephemeralPost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
            break;
        } catch (err) {
            if (attempt === 2) {
                throw err;
            }
        }
    }

    // * Verify ephemeral post appears with correct content and action buttons
    await expect(ephemeralPost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByText('test ephemeral actions', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Update', exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // # Click Update.
    // After clicking Update the text changes — re-find the post by its new content.
    // toBeVisible() re-resolves the locator on every retry, so it rides out the virtual
    // list's re-render on its own.
    await ephemeralPost.getByRole('button', {name: 'Update', exact: true}).click();
    const updatedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'updated ephemeral action'})
        .last();

    // * Verify post text and button label change
    await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Update 1', exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // # Click Delete.
    // After delete the text changes again — re-find by the new content.
    await updatedPost.getByRole('button', {name: 'Delete', exact: true}).click();
    const deletedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: '(message deleted)'})
        .last();

    // * Verify post content is removed and buttons are gone
    await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Update 1', exact: true})).not.toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Delete', exact: true})).not.toBeVisible();

    // # Send /ephemeral_override command (still in Town Square)
    await sendDemoSlashCommand(channelsPage.page, async () => {
        await channelsPage.centerView.postCreate.input.fill('/ephemeral_override');
        await channelsPage.centerView.postCreate.sendMessage();
    });

    // * Verify the override ephemeral post appears
    const overridePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'This is a demo of overriding an ephemeral post.'})
        .last();
    await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(
        overridePost.getByText('This is a demo of overriding an ephemeral post.', {exact: true}),
    ).toBeVisible();
});
