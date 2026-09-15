// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel drafts on the global Drafts page are scoped to the
 * current active team, while each team's Drafts LHS entry and pencil icons stay
 * independent.
 */
test(
    'MM-T4410 Channel Drafts are scoped to current active team',
    {tag: '@messaging'},
    async ({pw}) => {
        const team1Draft = `team1-draft-${pw.random.id()}`;
        const team2Draft = `team2-draft-${pw.random.id()}`;

        // # Create a user on Team1 and add them to a second team
        const {user, team: team1, adminClient} = await pw.initSetup();
        const team2 = await pw.createNewTeam(adminClient, {
            name: 'team',
            displayName: 'Team',
            type: 'O',
            unique: true,
        });
        await adminClient.addToTeam(team2.id, user.id);

        const {channelsPage, draftsPage} = await pw.testBrowser.login(user);

        // # Open Town Square on Team1 and leave a channel draft
        await channelsPage.goto(team1.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.writeMessage(team1Draft);

        // # Switch away so the draft is persisted with show:true
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');

        // * Global Drafts appears in the LHS with count 1
        await channelsPage.sidebarLeft.draftsVisible();
        expect(await channelsPage.sidebarLeft.getDraftsBadgeCount()).toBe('1');

        // * Town Square shows a pencil icon for the draft
        await expect(channelsPage.sidebarLeft.item('town-square').getByTestId('draftIcon')).toHaveCount(1);

        // # Switch to Team2 Off-Topic and leave a different channel draft
        await channelsPage.switchToTeam(team2.name);
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');
        await channelsPage.centerView.postCreate.writeMessage(team2Draft);

        // # Switch away so the Team2 draft is persisted with show:true
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // * Global Drafts appears in the LHS with count 1 for Team2 only
        await channelsPage.sidebarLeft.draftsVisible();
        expect(await channelsPage.sidebarLeft.getDraftsBadgeCount()).toBe('1');

        // * Off-Topic on Team2 shows a pencil icon for the draft
        await expect(channelsPage.sidebarLeft.item('off-topic').getByTestId('draftIcon')).toHaveCount(1);

        // # Open global Drafts on Team2
        await channelsPage.sidebarLeft.goToDrafts();
        await draftsPage.toBeVisible();

        // * Only the current team's draft is listed, for Off-Topic
        await draftsPage.expectDraftCount(1);
        expect(await draftsPage.getBadgeCountOnTab()).toBe('1');
        const team2DraftPost = await draftsPage.getDraftByChannelName('Off-Topic');
        await expect(team2DraftPost.panelHeader).toContainText('In:');
        await expect(team2DraftPost.panelHeader).toContainText('Off-Topic');
        await expect(team2DraftPost.panelBody).toContainText(team2Draft);

        // # Switch back to Team1
        await channelsPage.switchToTeam(team1.name);

        // * Drafts remains visible with count scoped to Team1
        await channelsPage.sidebarLeft.draftsVisible();
        expect(await channelsPage.sidebarLeft.getDraftsBadgeCount()).toBe('1');

        // # Open global Drafts on Team1
        await channelsPage.sidebarLeft.goToDrafts();
        await draftsPage.toBeVisible();

        // * Only the Town Square draft from Team1 is listed
        await draftsPage.expectDraftCount(1);
        expect(await draftsPage.getBadgeCountOnTab()).toBe('1');
        const team1DraftPost = await draftsPage.getDraftByChannelName('Town Square');
        await expect(team1DraftPost.panelHeader).toContainText('In:');
        await expect(team1DraftPost.panelHeader).toContainText('Town Square');
        await expect(team1DraftPost.panelBody).toContainText(team1Draft);
        await expect(draftsPage.draftViews()).not.toContainText(team2Draft);
    },
);
