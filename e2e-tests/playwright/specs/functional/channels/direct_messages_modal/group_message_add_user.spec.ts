// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {getChannelSlugFromUrl} from './helpers';

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
