// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelsPage} from '@mattermost/playwright-lib';
import {expect, test} from '@mattermost/playwright-lib';

// 11.7 does not have master's draftsLink / goToDrafts / switchToTeam helpers.
const draftsLink = (channelsPage: ChannelsPage) => channelsPage.sidebarLeft.container.locator('#sidebarItem_drafts');

// The LHS Drafts entry itself stays rendered for as long as the /drafts URL matches, so only
// its count badge can show that the last draft is gone.
const draftsCountBadge = (channelsPage: ChannelsPage) => draftsLink(channelsPage).getByTestId('draftIcon');

async function goToDrafts(channelsPage: ChannelsPage) {
    await channelsPage.sidebarLeft.draftsVisible();
    await draftsLink(channelsPage).click();
}

async function getDraftsBadgeCount(channelsPage: ChannelsPage) {
    const badge = draftsLink(channelsPage).locator('#unreadMentions .unreadMentions');
    await expect(badge).toBeVisible();
    return (await badge.textContent()) ?? '';
}

async function switchToTeam(channelsPage: ChannelsPage, teamName: string) {
    const teamButton = channelsPage.page.locator(`#${teamName}TeamButton`);
    await teamButton.waitFor();
    await teamButton.click();
}

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

        const {user, team: team1, adminClient, userClient} = await pw.initSetup();
        const team2 = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(team2.id, user.id);

        const {channelsPage, draftsPage} = await pw.testBrowser.login(user);

        // # Type a draft in Town Square without sending it
        await channelsPage.goto(team1.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.writeMessage(draftMessage);

        // # Switch channels so the draft is synced to the server
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');

        // * The draft is registered in the LHS
        await channelsPage.sidebarLeft.draftsVisible();
        expect(await getDraftsBadgeCount(channelsPage)).toBe('1');

        // # Send the draft from the Drafts panel
        await goToDrafts(channelsPage);
        await draftsPage.toBeVisible();
        await draftsPage.expectDraftCount(1);
        await draftsPage.sendDraft(await draftsPage.getDraftByChannelName('Town Square'));

        // * The draft was posted to Town Square and left the Drafts panel
        await channelsPage.centerView.header.toHaveTitle('Town Square');
        await channelsPage.centerView.waitUntilLastPostContains(draftMessage);
        await channelsPage.sidebarLeft.draftsNotVisible();

        // * No draft is left on the server for a team switch or a reload to restore
        // (the endpoint answers null, not [], once the user has no drafts)
        await expect.poll(async () => (await userClient.getUserDrafts(team1.id))?.length ?? 0).toBe(0);

        // # Switch to the other team and back, which refetches drafts from the server
        await switchToTeam(channelsPage, team2.name);
        await channelsPage.sidebarLeft.draftsNotVisible();
        await switchToTeam(channelsPage, team1.name);
        await channelsPage.toBeVisible();

        // * The sent draft did not reappear
        await channelsPage.sidebarLeft.draftsNotVisible();
        await expect(channelsPage.sidebarLeft.item('town-square').getByTestId('draftIcon')).not.toBeAttached();

        // * The Drafts page itself is empty, and the message is still posted
        await draftsPage.goto(team1.name);
        await expect(draftsPage.noDrafts).toBeVisible();
        await draftsPage.expectDraftCount(0);

        await channelsPage.goto(team1.name, 'town-square');
        await channelsPage.centerView.waitUntilLastPostContains(draftMessage);
    });

    /**
     * @objective Verify a thread draft sent from the global Drafts panel is deleted
     * server-side under its root id, not just cleared from local storage.
     */
    test('thread draft is deleted server-side under its root id', {tag: '@messaging'}, async ({pw}) => {
        const rootMessage = `thread-root-${pw.random.id()}`;
        const replyDraft = `thread-reply-draft-${pw.random.id()}`;

        const {user, team, userClient} = await pw.initSetup();
        const {channelsPage, draftsPage} = await pw.testBrowser.login(user);

        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Start a thread and leave a reply draft in it
        await channelsPage.centerView.postCreate.postMessage(rootMessage);
        await (await channelsPage.getLastPost()).openAThread();
        await channelsPage.sidebarRight.postCreate.writeMessage(replyDraft);

        // # Close the thread so the reply draft is synced to the server
        await channelsPage.sidebarRight.closeButton.click();
        await channelsPage.sidebarLeft.draftsVisible();

        // # Send the thread draft from the Drafts panel
        await goToDrafts(channelsPage);
        await draftsPage.toBeVisible();
        await draftsPage.expectDraftCount(1);
        await draftsPage.sendDraft(await draftsPage.getLastPost());

        // * The reply was posted into the thread, which opens in the RHS, and the draft is
        // gone from the Drafts page that sending it left open
        await expect(channelsPage.sidebarRight.container).toContainText(replyDraft);
        await expect(draftsPage.noDrafts).toBeVisible();
        await draftsPage.expectDraftCount(0);
        await expect(draftsCountBadge(channelsPage)).not.toBeAttached();

        // * No draft is left on the server under the thread's root id. Only this can catch
        // the bug: the panel and the badge above read local storage, which createPost clears
        // optimistically whether or not the server copy was deleted.
        await expect.poll(async () => (await userClient.getUserDrafts(team.id))?.length ?? 0).toBe(0);
    });
});
