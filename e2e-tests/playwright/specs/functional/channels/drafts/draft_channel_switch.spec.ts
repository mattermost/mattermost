// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, type App} from '@mattermost/playwright-lib';

/** Sends the composer's text as a post with the Send button, and returns the post the server created. */
async function send(app: App, text: string) {
    await app.center.postCreate.message.container.fill(text);
    return settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
}

/** Submits a slash command with the Send button: the client sends it to the command endpoint, not as a post. */
async function sendCommand(app: App, text: string) {
    await app.center.postCreate.message.container.fill(text);
    await settle(app.center.postCreate.sendButton, {wait: Api.ExecuteCommand}).click();
}

test.describe('draft channel switch', () => {
    /**
     * @objective Verify Ctrl/Cmd+K restores the destination draft and routes
     * messages to the selected channel.
     */
    test('quick switcher keeps drafts and messages scoped to their channels', {tag: '@messaging'}, async ({pw}) => {
        const {team, user, townSquare, offTopic} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});
        const input = app.center.postCreate.message.container.locator;
        const title = app.channelHeader.openMenuButton.locator;

        const originDraft = `quick-switch-origin-${pw.random.id()}`;
        const destinationMessage = `quick-switch-destination-${pw.random.id()}`;

        // # Leave a draft in Off-Topic
        await app.center.postCreate.message.container.fill(originDraft);

        // # Switch to Town Square using Ctrl/Cmd+K
        await app.center.postCreate.message.container.pressTo('ControlOrMeta+K', app.quickSwitchModal);
        await app.quickSwitchModal.searchTextbox.fill('town');
        await app.quickSwitchModal.suggestions.suggestion(townSquare.id).select();
        await expect(title).toContainText(townSquare.display_name);

        // * Town Square did not inherit the Off-Topic draft
        await expect(input).toHaveValue('');

        // # Send a destination-owned message
        const created = await send(app, destinationMessage);
        await expect(app.center.postList.post(created).message.container).toHaveText(destinationMessage);

        // # Return to Off-Topic using Ctrl/Cmd+K
        await app.center.postCreate.message.container.pressTo('ControlOrMeta+K', app.quickSwitchModal);
        await app.quickSwitchModal.searchTextbox.fill('off');
        await app.quickSwitchModal.suggestions.suggestion(offTopic.id).select();
        await expect(title).toContainText(offTopic.display_name);

        // * The origin draft was restored and the destination message was not misrouted
        await expect(input).toHaveValue(originDraft);
        await expect(app.center.postList.locator).not.toContainText(destinationMessage);
    });

    /**
     * @objective Verify sending /msg to an existing DM clears the origin
     * channel draft instead of leaving it behind for later restoration.
     *
     * @precondition
     * The DM channel already exists so the redirect uses the fast path with no
     * createDirectChannel round trip.
     */
    test(
        'sending /msg to an existing DM clears the origin draft instead of restoring it',
        {tag: '@slash_commands'},
        async ({pw}) => {
            const {adminClient, userClient, team, user, offTopic} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'draft-msg');
            await userClient.createDirectChannel([user.id, target.id]);
            const {app, page} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: offTopic});
            const input = app.center.postCreate.message.container.locator;
            const title = app.channelHeader.openMenuButton.locator;

            // Trailing space dismisses the @mention autocomplete.
            await sendCommand(app, `/msg @${target.username} `);
            await expect(title).toContainText(target.username);
            await expect(page).toHavePath(
                app.channelsPage.pathFor({team, path: 'messages', channel: `@${target.username}`}),
            );

            // * Destination composer is empty — it did not adopt the /msg text
            await expect(input).toHaveValue('');

            // # Return to Off-Topic
            await app.lhs.channelList.channel(offTopic).container.click();
            await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
            await expect(title).toContainText(offTopic.display_name);

            // * Origin draft was cleared by the submit, not left behind as /msg
            await expect(input).toHaveValue('');
            await expect(app.lhs.channelList.channel(offTopic).draftText.locator).toHaveCount(0);
        },
    );

    /**
     * @objective Verify a message typed after a settled /msg redirect to an
     * existing DM posts to the DM, not the origin channel.
     *
     * @precondition
     * The DM channel already exists so the redirect uses the fast path with no
     * createDirectChannel round trip.
     */
    test(
        'posts a later message to the DM rather than the origin channel after /msg',
        {tag: '@slash_commands'},
        async ({pw}) => {
            const {adminClient, userClient, team, user, offTopic} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'stale-dm');
            const dmChannel = await userClient.createDirectChannel([user.id, target.id]);
            await userClient.createPost({
                channel_id: dmChannel.id,
                message: 'seeding the existing DM',
            } as Parameters<typeof userClient.createPost>[0]);
            const {app, page} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: offTopic});
            const title = app.channelHeader.openMenuButton.locator;

            // Trailing space dismisses the @mention autocomplete.
            await sendCommand(app, `/msg @${target.username} `);
            await expect(title).toContainText(target.username);
            await expect(page).toHavePath(
                app.channelsPage.pathFor({team, path: 'messages', channel: `@${target.username}`}),
            );

            const message = `stale-draft-${pw.random.id()}`;
            await send(app, message);

            // * Follow-up message appears in the DM
            await expect
                .poll(async () => {
                    const lastId = (await app.center.postList.postList.keys()).at(-1);
                    return lastId ? app.center.postList.post({id: lastId}).message.container.locator.textContent() : '';
                })
                .toBe(message);

            // # Return to Off-Topic
            await app.lhs.channelList.channel(offTopic).container.click();
            await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
            await expect(title).toContainText(offTopic.display_name);

            // * Follow-up message did not post to the origin channel
            await expect(app.center.postList.locator).not.toContainText(message);
        },
    );
});
