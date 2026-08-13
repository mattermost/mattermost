// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

/**
 * @objective Verify users can be added and removed while creating a group message.
 */
test('MM-T460 Add and remove users while creating new Group Message', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 3, 'gm-edit');

    // # Open the Direct Messages modal and select two users
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await channelsPage.openDirectChannelsModal();
    await modal.selectUser(participants[0]);
    await modal.selectUser(participants[1]);

    // * Verify two users are selected, and the remaining-members counter reflects the selection
    // (a group message allows up to 8 members total, 7 besides the current user)
    await expect(modal.getRemoveButton(participants[0].username)).toBeVisible();
    await expect(modal.getRemoveButton(participants[1].username)).toBeVisible();
    await expect(modal.memberLimitHelpText).toContainText('You can add 5 more people');

    // # Remove one user via its remove button
    await modal.removeUser(participants[1].username);

    // * Verify the counter reflects the removal
    await expect(modal.memberLimitHelpText).toContainText('You can add 6 more people');

    // # Add a different user
    await modal.selectUser(participants[2]);

    // * Verify the selected list reflects the removal and addition, and the counter updates again
    await expect(modal.getRemoveButton(participants[1].username)).toHaveCount(0);
    await expect(modal.getRemoveButton(participants[2].username)).toBeVisible();
    await expect(modal.memberLimitHelpText).toContainText('You can add 5 more people');

    // # Remove the last selected user via backspace in the empty search input
    await modal.searchInput.press('Backspace');

    // * Verify the selected list and counter reflect the backspace removal
    await expect(modal.getRemoveButton(participants[2].username)).toHaveCount(0);
    await expect(modal.memberLimitHelpText).toContainText('You can add 6 more people');
});

/**
 * @objective Verify the group message intro, sidebar label, and member count render for participants.
 */
test('MM-T465 Create a group message and show participant details', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 2, 'gm-intro');

    // # Create a group message from the Direct Messages modal
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    const modal = await channelsPage.openDirectChannelsModal();
    for (const participant of participants) {
        await modal.selectUser(participant);
    }
    await modal.goToChannel();

    // * Verify the group message intro, participant avatars, sidebar label, and member count. The
    // sidebar label sorts the other participants' usernames with numeric-aware locale comparison
    // (digit runs compare by value, not by character code), so match that here rather than a plain
    // string sort.
    const sortedParticipants = [...participants].sort((a, b) =>
        a.username.localeCompare(b.username, undefined, {numeric: true}),
    );
    await expect(channelsPage.centerView.channelIntro).toContainText('This is the start of your group message history');
    await expect(channelsPage.centerView.channelIntro.locator('.profile-icon')).toHaveCount(2);
    await channelsPage.centerView.header.toHaveTitle(participants[0].username);
    await channelsPage.centerView.header.toHaveTitle(participants[1].username);
    await expect(channelsPage.sidebarLeft.item(participants[0].username)).toContainText(
        `${sortedParticipants[0].username}, ${sortedParticipants[1].username}`,
    );
    await expect(channelsPage.sidebarLeft.memberCountBadge(participants[0].username)).toContainText('2');

    // # Post a message so the group message persists in the sidebar
    await channelsPage.postMessage('Hi group');

    // * Verify the message appears in the group message
    await (await channelsPage.getLastPost()).toContainText('Hi group');
});

/**
 * @objective Verify that a group message lists its members and that adding another member creates a new group message.
 */
test(
    'MM-T467 adds a user to a group message to create a new group message',
    {tag: '@direct_messages'},
    async ({pw}) => {
        // # Create the test user plus three more users on the team
        const {user, team, adminClient} = await pw.initSetup();
        const [member1, member2, member3] = await adminClient.createUsers(team.id, 3, 'gm');

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Create a group message with two members
        const dmModal = await channelsPage.openDirectChannelsModal();
        await dmModal.selectUser(member1);
        await dmModal.selectUser(member2);
        await dmModal.goToChannel();
        const firstSlug = getChannelSlugFromUrl(page);

        // * Verify the group message lists both members in the header
        await channelsPage.centerView.header.toHaveTitle(member1.username);
        await channelsPage.centerView.header.toHaveTitle(member2.username);

        // # Create a group message that adds a third member
        const dmModal2 = await channelsPage.openDirectChannelsModal();
        await dmModal2.selectUser(member1);
        await dmModal2.selectUser(member2);
        await dmModal2.selectUser(member3);
        await dmModal2.goToChannel();

        // * Verify a new, different group message channel is created that includes the added member
        const secondSlug = getChannelSlugFromUrl(page);
        expect(secondSlug).not.toBe(firstSlug);
        await channelsPage.centerView.header.toHaveTitle(member3.username);
    },
);
