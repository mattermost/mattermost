// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

test.describe('draft channel switch', () => {
    /**
     * @objective Verify a typed draft on one channel persists, restores after
     * switching away and back, and posts only to the origin channel.
     */
    test('typed draft stays on the origin channel after switching away and back', {tag: '@messaging'}, async ({pw}) => {
        const {team, user} = await pw.initSetup();
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const originDraft = `origin-draft-${pw.random.id()}`;
        const destinationMessage = `town-square-${pw.random.id()}`;

        // # Type a draft in Off-Topic and do not send it
        await channelsPage.centerView.postCreate.writeMessage(originDraft);

        // # Switch to Town Square via the sidebar
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // * Destination composer must not inherit the origin draft
        expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');

        // * Origin draft was persisted: the channel pencil is in the DOM
        // (often CSS-hidden until hover) and the Drafts sidebar link appears
        await expect(channelsPage.sidebarLeft.item('off-topic').getByTestId('draftIcon')).toHaveCount(1);
        await channelsPage.sidebarLeft.draftsVisible();

        // # Send a different message from Town Square
        await channelsPage.centerView.postCreate.writeMessage(destinationMessage);
        await channelsPage.centerView.postCreate.sendMessage();

        // * Town Square shows the destination message
        await channelsPage.centerView.waitUntilLastPostContains(destinationMessage);

        // # Return to Off-Topic
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');

        // * Origin draft is still in the composer
        expect(await channelsPage.centerView.postCreate.getInputValue()).toBe(originDraft);

        // # Send the restored draft
        await channelsPage.centerView.postCreate.sendMessage();

        // * Off-Topic shows the origin draft message
        await channelsPage.centerView.waitUntilLastPostContains(originDraft);

        // # Return to Town Square
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // * Origin draft did not post to Town Square
        await expect(channelsPage.centerView.container).not.toContainText(originDraft);
    });

    /**
     * @objective Verify Ctrl/Cmd+K restores the destination draft and routes
     * messages to the selected channel with concurrent React enabled.
     */
    test(
        'quick switcher keeps drafts and messages scoped to their channels with concurrent React',
        {tag: '@messaging'},
        async ({pw}) => {
            await pw.ensureFeatureFlag('EnableConcurrentReact', true);

            const {team, user} = await pw.initSetup();
            const {channelsPage, page} = await pw.testBrowser.login(user);

            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            const originDraft = `quick-switch-origin-${pw.random.id()}`;
            const destinationMessage = `quick-switch-destination-${pw.random.id()}`;

            // # Leave a draft in Off-Topic
            await channelsPage.centerView.postCreate.writeMessage(originDraft);

            // # Switch to Town Square using Ctrl/Cmd+K
            await page.keyboard.press('ControlOrMeta+K');
            await expect(channelsPage.findChannelsModal.input).toBeVisible();
            await channelsPage.findChannelsModal.input.fill('town');
            await channelsPage.findChannelsModal.selectChannel('town-square');
            await channelsPage.centerView.header.toHaveTitle('Town Square');

            // * Town Square did not inherit the Off-Topic draft
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');

            // # Send a destination-owned message
            await channelsPage.centerView.postCreate.writeMessage(destinationMessage);
            await channelsPage.centerView.postCreate.sendMessage();
            await channelsPage.centerView.waitUntilLastPostContains(destinationMessage);

            // # Return to Off-Topic using Ctrl/Cmd+K
            await page.keyboard.press('ControlOrMeta+K');
            await expect(channelsPage.findChannelsModal.input).toBeVisible();
            await channelsPage.findChannelsModal.input.fill('off');
            await channelsPage.findChannelsModal.selectChannel('off-topic');
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * The origin draft was restored and the destination message was not misrouted
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe(originDraft);
            await expect(channelsPage.centerView.container).not.toContainText(destinationMessage);
        },
    );

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
            const {adminClient, userClient, team, user} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'draft-msg');

            await userClient.createDirectChannel([user.id, target.id]);

            const {channelsPage, page} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            // Trailing space dismisses the @mention autocomplete.
            await channelsPage.centerView.postCreate.writeMessage(`/msg @${target.username} `);
            await channelsPage.centerView.postCreate.sendMessage();

            await channelsPage.centerView.header.toHaveTitle(target.username);
            await expect(page).toHaveURL(new RegExp(`/${team.name}/messages/@${target.username}`));

            // * Destination composer is empty — it did not adopt the /msg text
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');

            // # Return to Off-Topic
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * Origin draft was cleared by the submit, not left behind as /msg
            expect(await channelsPage.centerView.postCreate.getInputValue()).toBe('');
            await expect(channelsPage.sidebarLeft.item('off-topic').getByTestId('draftIcon')).toHaveCount(0);
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
            const {adminClient, userClient, team, user} = await pw.initSetup();
            const [target] = await adminClient.createUsers(team.id, 1, 'stale-dm');

            const dmChannel = await userClient.createDirectChannel([user.id, target.id]);
            await userClient.createPost({
                channel_id: dmChannel.id,
                message: 'seeding the existing DM',
            } as Parameters<typeof userClient.createPost>[0]);

            const {channelsPage, page} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'off-topic');
            await channelsPage.toBeVisible();

            // Trailing space dismisses the @mention autocomplete.
            await channelsPage.centerView.postCreate.writeMessage(`/msg @${target.username} `);
            await channelsPage.centerView.postCreate.sendMessage();

            await channelsPage.centerView.header.toHaveTitle(target.username);
            await expect(page).toHaveURL(new RegExp(`/${team.name}/messages/@${target.username}`));

            const message = `stale-draft-${pw.random.id()}`;
            await channelsPage.centerView.postCreate.writeMessage(message);
            await channelsPage.centerView.postCreate.sendMessage();

            // * Follow-up message appears in the DM
            await channelsPage.centerView.waitUntilLastPostContains(message);

            // # Return to Off-Topic
            await channelsPage.sidebarLeft.goToItem('off-topic');
            await channelsPage.centerView.header.toHaveTitle('Off-Topic');

            // * Follow-up message did not post to the origin channel
            await expect(channelsPage.centerView.container).not.toContainText(message);
        },
    );
});
