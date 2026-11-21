// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel drafts on the global Drafts page are scoped to the
 * current active team, while each team's Drafts LHS entry and pencil icons stay
 * independent.
 */
test('MM-T4410 Channel Drafts are scoped to current active team', {tag: '@messaging'}, async ({pw}) => {
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

    const {app} = await pw.testBrowser.login(user);

    // # Open Town Square on Team1 and leave a channel draft
    await app.channelsPage.goto({team: team1, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();
    await app.center.postCreate.message.container.fill(team1Draft);
    await expect(app.center.postCreate.message.container).toHaveValue(team1Draft);

    // # Switch away so the draft is persisted with show:true
    await app.lhs.channelList.channel('off-topic').container.click();
    await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');

    // * Global Drafts appears in the LHS with count 1
    await expect(app.lhs.drafts.draftBadgeText).toHaveText('1');

    // * Town Square shows a pencil icon for the draft
    // (move the mouse off the sidebar first: the pencil is hidden while its row is hovered)
    await app.center.postCreate.message.container.hover();
    await expect(app.lhs.channelList.channel('town-square').draftText).toBeVisible();

    // # Switch to Team2 Off-Topic and leave a different channel draft
    await app.teamSidebar.team(team2).container.click();
    await expect(app.lhs.header.openTeamMenuButton).toContainText(team2.display_name);

    // * Team1's Town Square draft icon is not carried over into Team2's sidebar
    await expect(app.lhs.channelList.channel('town-square').draftText).not.toBeAttached();

    await app.lhs.channelList.channel('off-topic').container.click();
    await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');
    await app.center.postCreate.message.container.fill(team2Draft);
    await expect(app.center.postCreate.message.container).toHaveValue(team2Draft);

    // # Switch away so the Team2 draft is persisted with show:true
    await app.lhs.channelList.channel('town-square').container.click();
    await expect(app.channelHeader.openMenuButton).toContainText('Town Square');

    // * Global Drafts appears in the LHS with count 1 for Team2 only
    await expect(app.lhs.drafts.draftBadgeText).toHaveText('1');

    // * Off-Topic on Team2 shows a pencil icon for the draft
    // (move the mouse off the sidebar first: the pencil is hidden while its row is hovered)
    await app.center.postCreate.message.container.hover();
    await expect(app.lhs.channelList.channel('off-topic').draftText).toBeVisible();

    // # Open global Drafts on Team2
    await app.lhs.drafts.container.clickTo(app.drafts.tabs.draftsCountText);

    // * Only the current team's draft is listed, for Off-Topic
    await expect(app.drafts.saved.draftList).toHaveKeyCount(1);
    await expect(app.drafts.tabs.draftsCountText).toHaveText('1');
    const team2DraftPost = app.drafts.saved.draft(0);
    await expect(team2DraftPost.header.container).toContainText('In:');
    await expect(team2DraftPost.header.container).toContainText('Off-Topic');
    await expect(team2DraftPost.body).toContainText(team2Draft);

    // # Switch back to Team1
    await app.teamSidebar.team(team1).container.click();
    await expect(app.lhs.header.openTeamMenuButton).toContainText(team1.display_name);

    // * Team2's Off-Topic draft icon is not carried over into Team1's sidebar
    await expect(app.lhs.channelList.channel('off-topic').draftText).not.toBeAttached();

    // * Drafts remains visible with count scoped to Team1
    await expect(app.lhs.drafts.draftBadgeText).toHaveText('1');

    // # Open global Drafts on Team1
    await app.lhs.drafts.container.clickTo(app.drafts.tabs.draftsCountText);

    // * Only the Town Square draft from Team1 is listed
    await expect(app.drafts.saved.draftList).toHaveKeyCount(1);
    await expect(app.drafts.tabs.draftsCountText).toHaveText('1');
    const team1DraftPost = app.drafts.saved.draft(0);
    await expect(team1DraftPost.header.container).toContainText('In:');
    await expect(team1DraftPost.header.container).toContainText('Town Square');
    await expect(team1DraftPost.body).toContainText(team1Draft);
    await expect(team1DraftPost).not.toContainText(team2Draft);
});
