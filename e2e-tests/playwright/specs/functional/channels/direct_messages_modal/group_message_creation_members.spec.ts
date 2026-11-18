// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test} from '@mattermost/playwright-lib';

import {goToChannel, openDirectMessages, selectUser} from './dm_dialog';
import {getChannelSlugFromUrl} from './helpers';

/**
 * @objective Verify users can be added and removed while creating a group message.
 */
test('MM-T460 Add and remove users while creating new Group Message', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 3, 'gm-edit');

    // # Open the Direct Messages modal and select two users
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();
    const modal = await openDirectMessages(app);
    await selectUser(app, participants[0]);
    await selectUser(app, participants[1]);

    // * Verify two users are selected, and the remaining-members counter reflects the selection
    // (a group message allows up to 8 members total, 7 besides the current user)
    await expect(modal.options.remove(participants[0].id)).toBeVisible();
    await expect(modal.options.remove(participants[1].id)).toBeVisible();
    await expect(modal.options.helpText).toContainText('You can add 5 more people');

    // # Remove one user via its remove button
    await modal.options.remove(participants[1].id).click();
    await expect(modal.options.remove(participants[1].id)).toHaveCount(0);

    // * Verify the counter reflects the removal
    await expect(modal.options.helpText).toContainText('You can add 6 more people');

    // # Add a different user
    await selectUser(app, participants[2]);

    // * Verify the selected list reflects the removal and addition, and the counter updates again
    await expect(modal.options.remove(participants[1].id)).toHaveCount(0);
    await expect(modal.options.remove(participants[2].id)).toBeVisible();
    await expect(modal.options.helpText).toContainText('You can add 5 more people');

    // # Remove the last selected user via backspace in the empty search input
    await modal.options.searchCombobox.press('Backspace');

    // * Verify the selected list and counter reflect the backspace removal
    await expect(modal.options.remove(participants[2].id)).toHaveCount(0);
    await expect(modal.options.helpText).toContainText('You can add 6 more people');
});

/**
 * @objective Verify the group message intro, sidebar label, and member count render for participants.
 */
test('MM-T465 Create a group message and show participant details', async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const participants = await adminClient.createUsers(team.id, 2, 'gm-intro');

    // # Create a group message from the Direct Messages modal
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: 'town-square'});
    await expect(app.center.postCreate).toBeVisible();
    await openDirectMessages(app);
    for (const participant of participants) {
        await selectUser(app, participant);
    }
    await goToChannel(app);

    // * Verify the group message intro, participant avatars, sidebar label, and member count. The
    // sidebar label sorts the other participants' usernames with numeric-aware locale comparison
    // (digit runs compare by value, not by character code), so match that here rather than a plain
    // string sort.
    const sortedParticipants = [...participants].sort((a, b) =>
        a.username.localeCompare(b.username, undefined, {numeric: true}),
    );
    await expect(app.center.postList.channelIntro).toContainText('This is the start of your group message history');
    await expect(app.center.postList.channelIntro.member).toHaveCount(2);
    await expect(app.channelHeader.openMenuButton).toContainText(participants[0].username);
    await expect(app.channelHeader.openMenuButton).toContainText(participants[1].username);
    const gmName = getChannelSlugFromUrl(app.page);
    const sidebarItem = app.lhs.channelList.channel(gmName);
    await expect(sidebarItem).toContainText(`${sortedParticipants[0].username}, ${sortedParticipants[1].username}`);
    await expect(sidebarItem.memberCountText).toContainText('2');

    // # Post a message so the group message persists in the sidebar
    await app.center.postCreate.message.container.fill('Hi group');
    const created = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * Verify the message appears in the group message
    await expect(app.center.postList.post(created)).toContainText('Hi group');
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

        const {app, page} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a group message with two members
        await openDirectMessages(app);
        await selectUser(app, member1);
        await selectUser(app, member2);
        await goToChannel(app);
        const firstSlug = getChannelSlugFromUrl(page);

        // * Verify the group message lists both members in the header
        await expect(app.channelHeader.openMenuButton).toContainText(member1.username);
        await expect(app.channelHeader.openMenuButton).toContainText(member2.username);

        // # Create a group message that adds a third member
        await openDirectMessages(app);
        await selectUser(app, member1);
        await selectUser(app, member2);
        await selectUser(app, member3);
        await goToChannel(app);

        // * Verify a new, different group message channel is created that includes the added member
        const secondSlug = getChannelSlugFromUrl(page);
        expect(secondSlug).not.toBe(firstSlug);
        await expect(app.channelHeader.openMenuButton).toContainText(member3.username);
    },
);
