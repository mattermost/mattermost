// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, test} from '@mattermost/playwright-lib';

import {sendDemoSlashCommand} from '../../helpers';

test('should send ephemeral post with Update and Delete actions via /ephemeral command', async ({pw}) => {
    // A concurrent plugin_crash.spec.ts worker can leave the demo plugin's post-action hooks
    // broken for up to ~50s while it crashes and fully recovers the shared plugin (see that
    // spec for the recovery budget the retries below are sized against). test.slow() triples
    // the test timeout so those retries have room to outlast that window.
    test.slow();

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

    // # Click Update (with retries if the plugin is transiently unavailable, e.g. during a
    // concurrent plugin_crash.spec.ts recovery cycle, in which case the button-click action
    // request can fail silently and the post never updates — re-clicking Update is safe
    // since it's still showing its pre-update content and button on failure).
    // After clicking Update the text changes — re-find the post by its new content.
    // toBeVisible() re-resolves the locator on every retry, so it rides out the virtual
    // list's re-render on its own.
    const updatedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'updated ephemeral action'})
        .last();
    for (let attempt = 0; attempt < 8; attempt++) {
        await ephemeralPost.getByRole('button', {name: 'Update', exact: true}).click();
        try {
            await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible({
                timeout: duration.ten_sec,
            });
            break;
        } catch (err) {
            if (attempt === 7) {
                throw err;
            }
        }
    }

    // * Verify post text and button label change
    await expect(updatedPost.getByText('updated ephemeral action', {exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Update 1', exact: true})).toBeVisible();
    await expect(updatedPost.getByRole('button', {name: 'Delete', exact: true})).toBeVisible();

    // # Click Delete (with the same retry rationale as Update above).
    // After delete the text changes again — re-find by the new content.
    const deletedPost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: '(message deleted)'})
        .last();
    for (let attempt = 0; attempt < 8; attempt++) {
        await updatedPost.getByRole('button', {name: 'Delete', exact: true}).click();
        try {
            await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible({
                timeout: duration.ten_sec,
            });
            break;
        } catch (err) {
            if (attempt === 7) {
                throw err;
            }
        }
    }

    // * Verify post content is removed and buttons are gone
    await expect(deletedPost.getByText('(message deleted)', {exact: true})).toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Update 1', exact: true})).not.toBeVisible();
    await expect(deletedPost.getByRole('button', {name: 'Delete', exact: true})).not.toBeVisible();

    // # Send /ephemeral_override command (still in Town Square), with retries if the plugin
    // is transiently unavailable (e.g. during a concurrent plugin_crash.spec.ts recovery cycle)
    const overridePost = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'This is a demo of overriding an ephemeral post.'})
        .last();
    for (let attempt = 0; attempt < 3; attempt++) {
        await sendDemoSlashCommand(channelsPage.page, async () => {
            await channelsPage.centerView.postCreate.input.fill('/ephemeral_override');
            await channelsPage.centerView.postCreate.sendMessage();
        });
        try {
            await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
            break;
        } catch (err) {
            if (attempt === 2) {
                throw err;
            }
        }
    }

    // * Verify the override ephemeral post appears
    await expect(overridePost.getByText('(Only visible to you)', {exact: true})).toBeVisible();
    await expect(
        overridePost.getByText('This is a demo of overriding an ephemeral post.', {exact: true}),
    ).toBeVisible();
});
