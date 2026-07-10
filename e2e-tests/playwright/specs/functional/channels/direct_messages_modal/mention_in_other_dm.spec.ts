// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that mentioning a user inside a different pair of users' direct message does not notify the mentioned user.
 */
test('MM-T448 does not notify a user mentioned in a different DM', {tag: '@direct_messages'}, async ({pw}) => {
    // # Create the test user plus two more users on the team
    const {user, team, adminClient} = await pw.initSetup();
    const [partner, mentioned] = await adminClient.createUsers(team.id, 2, 'dmuser');

    const token = `dmmention${pw.random.id()}`;

    // # As the test user, open a DM with the partner and mention the third user there
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const dmModal = await channelsPage.openDirectChannelsModal();
    await dmModal.selectUser(partner);
    await dmModal.goToChannel();
    await channelsPage.postMessage(`@${mentioned.username} ${token}`);
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toContainText(token);

    // # Log in as the mentioned user and open Recent Mentions
    const {channelsPage: mentionedPage} = await pw.testBrowser.login(mentioned);
    await mentionedPage.goto(team.name, 'town-square');
    await mentionedPage.toBeVisible();
    await mentionedPage.globalHeader.openRecentMentions();

    // * Verify the mentioned user did not receive the mention from the other users' DM
    await mentionedPage.searchResultsPanel.toBeVisible();
    await expect(mentionedPage.searchResultsPanel.getResultByText(token)).toHaveCount(0);
});
