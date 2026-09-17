// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, hasCustomPermissionsSchemesLicense, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify the message composer is greyed out and non-interactive in a channel where the user
 * does not have permission to post.
 */
test('greys out the composer in a read-only channel', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();

    const license = await adminClient.getClientLicenseOld();
    test.skip(!hasCustomPermissionsSchemesLicense(license), 'Server does not have Custom Permission Schemes');

    const channel = await adminClient.createPublicChannel(team.id, `Read only ${pw.random.id()}`);
    await adminClient.addToChannel(user.id, channel.id);

    // # Give the team an isolated scheme whose members cannot create posts
    const scheme = await adminClient.createScheme({
        display_name: `Read only permissions ${pw.random.id()}`,
        scope: 'team',
    });
    const channelUserRole = await adminClient.getRoleByName(scheme.default_channel_user_role);
    await adminClient.patchRole(channelUserRole.id, {
        permissions: channelUserRole.permissions.filter((permission) => permission !== 'create_post'),
    });
    await adminClient.updateTeamScheme(team.id, scheme.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    const postCreate = channelsPage.centerView.postCreate;

    // * Verify the composer explains that the channel cannot be posted to
    await expect(postCreate.input).toHaveAttribute(
        'placeholder',
        'This channel is read-only. Only members with permission can post here.',
    );

    // * Verify the composer is greyed out and cannot be interacted with
    await expect(postCreate.editorBody).toHaveCSS('opacity', '0.7');
    await expect(postCreate.editorBody).toHaveCSS('pointer-events', 'none');
});
