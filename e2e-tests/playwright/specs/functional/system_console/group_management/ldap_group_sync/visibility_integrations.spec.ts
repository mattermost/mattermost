// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {initializeLdapGroupSync, setupLdapGroupSync} from './support';

test.describe('LDAP group-synchronized channel visibility and integrations', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await initializeLdapGroupSync(pw);
    });

    /**
     * @objective Verify a non-member sees a public channel in the switcher but not after it becomes private
     */
    test(
        'MM-T2640 - Channel appears in channel switcher before conversion but not after (for non-members of the channel)',
        {
            tag: '@ldap',
        },
        async ({pw}) => {
            const {adminClient, user, team, channel} = await setupLdapGroupSync(pw);
            const publicChannel = await adminClient.createPublicChannel(team.id, 'Switcher Candidate');
            const {page} = await pw.testBrowser.login(user);
            await page.goto(`/${team.name}/channels/${channel.name}`);

            // # Search for the public channel in the channel switcher
            await page.getByRole('button', {name: /Find channel/i}).click();
            await page.getByRole('combobox', {name: 'quick switch input'}).fill(publicChannel.display_name);

            // * Verify the public channel is suggested
            await expect(page.getByText(publicChannel.display_name, {exact: true})).toBeVisible();

            // # Convert the candidate to private and search again
            await adminClient.updateChannelPrivacy(publicChannel.id, 'P');
            await page.getByRole('combobox', {name: 'quick switch input'}).fill('');
            await page.getByRole('combobox', {name: 'quick switch input'}).fill(publicChannel.display_name);

            // * Verify there are no results
            await expect(page.getByText(/No results for/)).toBeVisible();
        },
    );

    /**
     * @objective Verify Browse Channels lists a public channel but not after conversion to private
     */
    test(
        'MM-T2641 - Channel appears in More... under Public Channels before conversion but not after',
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, user, team} = await setupLdapGroupSync(pw);
            const publicChannel = await adminClient.createPublicChannel(team.id, 'Browse Candidate');
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'off-topic');
            let modal = await channelsPage.openBrowseChannelsModal();

            // # Search Browse Channels for the public channel
            await modal.searchInput.fill(publicChannel.display_name);

            // * Verify the public channel is listed
            await expect(modal.container.getByText(publicChannel.display_name, {exact: true})).toBeVisible();

            // # Convert it to private and search again
            await modal.close();
            await adminClient.updateChannelPrivacy(publicChannel.id, 'P');
            modal = await channelsPage.openBrowseChannelsModal();
            await modal.searchInput.fill(publicChannel.display_name);

            // * Verify the private channel is absent
            await expect(modal.container.getByText(/No results for/)).toBeVisible();
        },
    );

    /**
     * @objective Verify outgoing webhook channel options omit channels after conversion to private
     */
    test(
        'MM-T2642 - Channel appears in Integrations options before conversion but not after',
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, adminUser, team, channel} = await setupLdapGroupSync(pw);
            const {page} = await pw.testBrowser.login(adminUser);

            // # Open the outgoing webhook creation page
            await page.goto(`/${team.name}/integrations/outgoing_webhooks/add`);
            const channelSelect = page.getByRole('combobox').filter({
                has: page.getByRole('option', {name: '--- Select a channel ---', exact: true}),
            });

            // * Verify the public channel appears in the channel options
            await expect(channelSelect.getByRole('option', {name: channel.display_name})).toHaveCount(1);

            // # Convert the channel to private and reload the integration page
            await adminClient.updateChannelPrivacy(channel.id, 'P');
            await page.reload();

            // * Verify the private channel is omitted
            await expect(channelSelect.getByRole('option', {name: channel.display_name})).toHaveCount(0);
        },
    );
});
