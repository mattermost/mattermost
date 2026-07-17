// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {initializeLdapGroupSync, setupLdapGroupSync} from './support';

test.describe('LDAP group-synchronized channel privacy', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await initializeLdapGroupSync(pw);
    });

    /**
     * @objective Verify canceling a channel privacy change preserves public state and saving makes it private
     */
    test('MM-T2628 - List of Channels', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, team, channel} = await setupLdapGroupSync(pw);
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);

        // # Change the channel to private, cancel, and discard changes
        await consolePage.channelConfiguration.goto(channel.id);
        await consolePage.channelConfiguration.setPublic(false);
        await page.getByRole('link', {name: 'Cancel', exact: true}).click();
        await page.getByRole('button', {name: /Discard|Yes/}).click();
        await consolePage.channelConfiguration.goto(channel.id);

        // * Verify the channel is still public
        await expect(page.getByRole('button', {name: 'Public', exact: true})).toBeVisible();

        // # Save the channel as private
        await consolePage.channelConfiguration.setPublic(false);
        await consolePage.channelConfiguration.save(true);

        // * Verify the server persisted private channel state
        expect((await adminClient.getChannel(channel.id)).type).toBe('P');

        // # Browse channels from the team
        const {channelsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        const modal = await channelsPage.openBrowseChannelsModal();
        await modal.searchInput.fill(channel.display_name);

        // * Verify the member can still find the private channel
        await expect(modal.container.getByText(channel.display_name, {exact: true})).toBeVisible();
    });

    /**
     * @objective Verify canceling and saving a private-to-public conversion behaves correctly and posts a system message
     */
    test('MM-T2629 - Private to public - More....', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, adminUser, team} = await setupLdapGroupSync(pw);
        const channel = await adminClient.createPrivateChannel(team.id, 'Private Channel');
        await adminClient.addToChannel(adminUser.id, channel.id);
        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);

        // # Change to public, cancel, and discard
        await consolePage.channelConfiguration.goto(channel.id);
        await consolePage.channelConfiguration.setPublic(true);
        await page.getByRole('link', {name: 'Cancel', exact: true}).click();
        await page.getByRole('button', {name: /Discard|Yes/}).click();
        expect((await adminClient.getChannel(channel.id)).type).toBe('P');

        // # Change to public and save
        await consolePage.channelConfiguration.goto(channel.id);
        await consolePage.channelConfiguration.setPublic(true);
        await consolePage.channelConfiguration.save(true);

        // * Verify public state persists
        expect((await adminClient.getChannel(channel.id)).type).toBe('O');

        // * Verify the conversion system message is posted
        const {channelsPage, page: channelsBrowserPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, channel.name);
        await expect(
            channelsBrowserPage
                .getByText('This channel has been converted to a Public Channel and can be joined by any team member')
                .last(),
        ).toBeVisible();
    });

    /**
     * @objective Verify Town Square disables both LDAP synchronization and privacy toggles. This consolidates MM-T4003_3 because it exercises the same immutable default-channel controls as MM-T2630.
     */
    test(
        'MM-T2630 MM-T4003_3 keeps default channel synchronization and privacy toggles disabled',
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, adminUser, team} = await setupLdapGroupSync(pw);
            const townSquare = await adminClient.getChannelByName(team.id, 'town-square');
            const {page} = await pw.testBrowser.login(adminUser);
            const consolePage = new SystemConsolePage(page);

            // # Open Town Square channel configuration
            await consolePage.channelConfiguration.goto(townSquare.id);

            // * Verify its group synchronization and public/private controls are disabled
            await consolePage.channelConfiguration.expectDefaultChannelTogglesToBeDisabled();
        },
    );
});
