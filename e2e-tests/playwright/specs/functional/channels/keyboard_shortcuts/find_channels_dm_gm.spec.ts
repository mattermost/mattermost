// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the Ctrl/Cmd+K quick switcher can find and open a direct message, a group message,
 * and a public channel.
 */
test(
    'MM-T1247 finds and opens a direct message, group message, and channel with Ctrl/Cmd+K',
    {tag: '@keyboard_shortcuts'},
    async ({pw}) => {
        const {adminClient, team, user} = await pw.initSetup();
        const [member1, member2] = await adminClient.createUsers(team.id, 2, 'switch');

        // # Create a direct message, a group message, and a public channel for the user
        const dm = await adminClient.createDirectChannel([user.id, member1.id]);
        await adminClient.createPost({channel_id: dm.id, user_id: member1.id, message: 'dm hello'});
        const gm = await adminClient.createGroupChannel([user.id, member1.id, member2.id]);
        await adminClient.createPost({channel_id: gm.id, user_id: member2.id, message: 'gm hello'});
        const publicChannel = await adminClient.createPublicChannel(team.id, `Switcher ${pw.random.id()}`);
        await adminClient.addToChannel(user.id, publicChannel.id);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {findChannelsModal} = channelsPage;
        const options = () => findChannelsModal.container.getByRole('option');

        // # Open the quick switcher and open the direct message with member1 (the option with only member1)
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(member1.username);
        await options().filter({hasText: member1.username, hasNotText: member2.username}).first().click();

        // * Verify the direct message with member1 is opened
        await channelsPage.centerView.header.toHaveTitle(member1.username);

        // # Open the quick switcher and open the group message (the option containing both members)
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(member2.username);
        await options().filter({hasText: member1.username}).filter({hasText: member2.username}).first().click();

        // * Verify the group message (containing both members) is opened
        await channelsPage.centerView.header.toHaveTitle(member1.username);
        await channelsPage.centerView.header.toHaveTitle(member2.username);

        // # Open the quick switcher and open the public channel
        await page.keyboard.press('ControlOrMeta+K');
        await findChannelsModal.input.fill(publicChannel.display_name);
        await options().filter({hasText: publicChannel.display_name}).first().click();

        // * Verify the public channel is opened
        await channelsPage.centerView.header.toHaveTitle(publicChannel.display_name);
    },
);
