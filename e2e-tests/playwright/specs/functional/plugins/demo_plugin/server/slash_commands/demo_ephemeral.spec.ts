// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

test('should send ephemeral post with Update and Delete actions via /ephemeral command', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square — avoids noise from demo plugin's own ephemeral messages
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send /ephemeral command
    await channelsPage.centerView.postCreate.input.fill('/ephemeral');
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Verify ephemeral post appears with correct content and action buttons
    // Scope to the specific post to avoid strict mode violation if multiple ephemeral posts are visible
    const ephemeralPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'test ephemeral actions'})
        .last();
    await expect(ephemeralPost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByText('test ephemeral actions', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Update', exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // 6. Click Update and verify post text and button label change
    // After clicking Update the text changes — re-find the post by its new content
    await ephemeralPost.getByRole('button', {name: 'Update', exact: true}).click();
    const updatedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'updated ephemeral action'})
        .last();
    await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Update 1', exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // 7. Click Delete and verify post content is removed and buttons are gone
    // After delete the text changes again — re-find by the new content
    await updatedPost.getByRole('button', {name: 'Delete', exact: true}).click();
    const deletedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: '(message deleted)'})
        .last();
    await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Update 1', exact: true})).not.toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Delete', exact: true})).not.toBeVisible();

    // 8. Send /ephemeral_override command (still in Town Square)
    await channelsPage.centerView.postCreate.input.fill('/ephemeral_override');
    await channelsPage.centerView.postCreate.sendMessage();

    // 9. Verify the override ephemeral post appears
    const overridePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'This is a demo of overriding an ephemeral post.'})
        .last();
    await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(
        overridePost.getByText('This is a demo of overriding an ephemeral post.', {exact: true}),
    ).toBeVisible();
});
