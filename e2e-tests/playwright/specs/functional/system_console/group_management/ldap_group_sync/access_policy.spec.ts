// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {initializeLdapGroupSync, setupLdapGroupSync} from './support';

test.describe('LDAP group-synchronized channel access and policy', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await initializeLdapGroupSync(pw);
    });

    /**
     * @objective Verify a non-member can follow a public permalink but not after the channel becomes private
     */
    test(
        'MM-T2638 - Permalink from when public does not auto-join (non-system-admin) after converting to private',
        {
            tag: '@ldap',
        },
        async ({pw}) => {
            const {adminClient, user, team, channel} = await setupLdapGroupSync(pw);
            const post = await adminClient.createPost({channel_id: channel.id, message: 'LDAP permalink visibility'});
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.removeFromChannel(user.id, channel.id);
            const {page} = await pw.testBrowser.login(user);

            // # Open the public channel permalink
            await page.goto(`/${team.name}/pl/${post.id}`);

            // * Verify the public message is visible
            await expect(page.getByText('LDAP permalink visibility')).toBeVisible();

            // # Leave the auto-joined public channel, convert it to private, and revisit
            await adminClient.removeFromChannel(user.id, channel.id);
            await adminClient.updateChannelPrivacy(channel.id, 'P');
            await page.reload();

            // * Verify the private message cannot be found
            await expect(page.getByRole('heading', {name: /(Message|Channel) Not Found/})).toBeVisible();
        },
    );

    /**
     * @objective Verify private-channel membership policy removes ordinary users' ability to add members
     */
    test('MM-T2639 - Policy settings (in System Console tests, likely)', {tag: '@ldap'}, async ({pw}) => {
        const {adminClient, user, team, channel} = await setupLdapGroupSync(pw);
        await adminClient.addToChannel(user.id, channel.id);
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, channel.name);
        const [channelUserRole] = await adminClient.getRolesByNames(['channel_user']);
        const originalPermissions = channelUserRole.permissions;

        try {
            // # Open the channel members panel
            await page.getByRole('button', {name: 'Members', exact: true}).click();

            // * Verify members can initially be added
            await expect(page.getByRole('region', {name: 'Members'}).getByRole('button', {name: /Add$/})).toBeVisible();

            // # Convert the channel to private and remove the user's manage-private-channel permission
            await adminClient.updateChannelPrivacy(channel.id, 'P');
            await adminClient.patchRole(channelUserRole.id, {
                permissions: originalPermissions.filter(
                    (permission: string) => permission !== 'manage_private_channel_members',
                ),
            });
            await page.reload();
            await page.getByRole('button', {name: 'Members', exact: true}).click();

            // * Verify the user can no longer add members
            await expect(
                page.getByRole('region', {name: 'Members'}).getByRole('button', {name: /Add$/}),
            ).not.toBeVisible();
        } finally {
            await adminClient.patchRole(channelUserRole.id, {permissions: originalPermissions});
        }
    });
});
