// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {centerPostWithText, sendDemoSlashCommand} from '../../helpers';

test('should send ephemeral post with Update and Delete actions via /ephemeral command', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login
    const {app} = await pw.testBrowser.login(user);

    // # Navigate to Town Square — avoids noise from demo plugin's own ephemeral messages
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Send /ephemeral command
    const ephemeralPost = centerPostWithText(app, 'test ephemeral actions');
    await sendDemoSlashCommand(app, '/ephemeral');
    await expect(ephemeralPost.getByText('(Only visible to you)', {exact: true})).toBeVisible();

    // * Verify ephemeral post appears with correct content and action buttons
    await expect(ephemeralPost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByText('test ephemeral actions', {exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Update', exact: true})).toBeVisible();
    await expect(ephemeralPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // # Click Update
    // After clicking Update the text changes — re-find the post by its new content.
    const updatedPost = centerPostWithText(app, 'updated ephemeral action');
    await ephemeralPost.getByRole('button', {name: 'Update', exact: true}).click();
    await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible();

    // * Verify post text and button label change
    await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Update 1', exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // # Click Delete
    // After delete the text changes again — re-find by the new content.
    const deletedPost = centerPostWithText(app, '(message deleted)');
    await updatedPost.getByRole('button', {name: 'Delete', exact: true}).click();
    await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible();

    // * Verify post content is removed and buttons are gone
    await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Update 1', exact: true})).not.toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Delete', exact: true})).not.toBeVisible();

    // # Send /ephemeral_override command (still in Town Square)
    const overridePost = centerPostWithText(app, 'This is a demo of overriding an ephemeral post.');
    await sendDemoSlashCommand(app, '/ephemeral_override');
    await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();

    // * Verify the override ephemeral post appears
    await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(
        overridePost.getByText('This is a demo of overriding an ephemeral post.', {exact: true}),
    ).toBeVisible();
});
