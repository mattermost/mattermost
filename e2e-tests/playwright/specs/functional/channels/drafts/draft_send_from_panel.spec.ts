// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

test.describe('sending a draft from the Drafts panel', () => {
    /**
     * @objective Verify a channel draft sent from the global Drafts panel is deleted
     * server-side, so switching teams away and back does not restore it.
     *
     * @precondition
     * The user belongs to two teams, so a team switch refetches drafts from the server.
     */
    test('channel draft does not come back after switching teams', {tag: '@messaging'}, async ({pw}) => {
        const draftMessage = `panel-send-${pw.random.id()}`;

        const {user, team: team1, adminClient, userClient, townSquare, offTopic} = await pw.initSetup();
        const team2 = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(team2.id, user.id);

        const {app} = await pw.testBrowser.login(user);

        // # Type a draft in Town Square without sending it
        await app.channelsPage.goto({team: team1, channel: townSquare});
        await app.center.postCreate.message.container.fill(draftMessage);

        // # Switch channels so the draft is synced to the server
        await app.lhs.channelList.channel(offTopic).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');

        // * The draft is registered in the LHS
        await expect(app.lhs.drafts.container).toBeVisible();
        await expect(app.lhs.drafts.draftBadgeText).toHaveText('1');

        // # Send the draft from the Drafts panel
        await app.lhs.drafts.container.click();
        await expect(app.drafts.saved.draftList).toHaveKeyCount(1);
        const sendModal = await app.drafts.saved.draft(0).sendButton.clickTo(app.sendDraftModal);
        await sendModal.confirmButton.click();

        // * The draft was posted to Town Square and left the Drafts panel
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');
        await expect((await app.center.postList.postList.last()).message.container).toContainText(draftMessage);
        await expect(app.lhs.drafts.container).not.toBeVisible();

        // * No draft is left on the server for a team switch or a reload to restore
        // (the endpoint answers null, not [], once the user has no drafts)
        await expect.poll(async () => (await userClient.getUserDrafts(team1.id))?.length ?? 0).toBe(0);

        // # Switch to the other team and back, which refetches drafts from the server
        await app.teamPage.goto({team: team2});
        await expect(app.lhs.drafts.container).not.toBeVisible();
        await app.teamPage.goto({team: team1});
        await expect(app.center.postCreate.container).toBeVisible();

        // * The sent draft did not reappear
        await expect(app.lhs.drafts.container).not.toBeVisible();
        await expect(app.lhs.channelList.channel(townSquare).draftText).not.toBeAttached();

        // * The Drafts page itself is empty, and the message is still posted
        await app.draftsPage.goto({team: team1});
        await expect(app.noResults).toBeVisible();
        await expect(app.drafts.saved.draftList).toHaveKeyCount(0);

        await app.channelsPage.goto({team: team1, channel: townSquare});
        await expect((await app.center.postList.postList.last()).message.container).toContainText(draftMessage);
    });

    /**
     * @objective Verify a thread draft sent from the global Drafts panel is deleted
     * server-side under its root id, not just cleared from local storage.
     */
    test('thread draft is deleted server-side under its root id', {tag: '@messaging'}, async ({pw}) => {
        const rootMessage = `thread-root-${pw.random.id()}`;
        const replyDraft = `thread-reply-draft-${pw.random.id()}`;

        const {user, team, userClient, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);

        await app.channelsPage.goto({team, channel: townSquare});

        // # Start a thread and leave a reply draft in it
        await app.center.postCreate.message.container.fill(rootMessage);
        const root = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
        // The post's actions show on hover.
        await app.center.postList.post(root).container.hover();
        await app.center.postList.post(root).menu.replyButton.click();
        await expect(app.rhs.postCreate.message.container).toBeVisible();
        await app.rhs.postCreate.message.container.fill(replyDraft);

        // # Close the thread so the reply draft is synced to the server
        await app.rhs.thread.header.closeButton.click();
        await expect(app.rhs.thread.header.closeButton).not.toBeVisible();
        await expect(app.lhs.drafts.container).toBeVisible();

        // # Send the thread draft from the Drafts panel
        await app.lhs.drafts.container.click();
        await expect(app.drafts.saved.draftList).toHaveKeyCount(1);
        const sendModal = await app.drafts.saved.draft(0).sendButton.clickTo(app.sendDraftModal);
        await sendModal.confirmButton.click();

        // * The reply was posted into the thread, which opens in the RHS, and the draft is
        // gone from the Drafts page that sending it left open
        await expect((await app.rhs.thread.postList.last()).message.container).toContainText(replyDraft);
        await expect(app.noResults).toBeVisible();
        await expect(app.drafts.saved.draftList).toHaveKeyCount(0);
        await expect(app.lhs.drafts.draftBadgeText).not.toBeAttached();

        // * No draft is left on the server under the thread's root id. Only this can catch
        // the bug: the panel and the badge above read local storage, which createPost clears
        // optimistically whether or not the server copy was deleted.
        await expect.poll(async () => (await userClient.getUserDrafts(team.id))?.length ?? 0).toBe(0);
    });
});
