// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a system admin viewing the System Console loses access and is returned to the
 * channel view when another admin demotes them to a regular member.
 */
test('MM-T2552 redirects a demoted admin out of the System Console', {tag: '@system_console'}, async ({pw}) => {
    const {user, adminClient} = await pw.initSetup();

    // # Promote the user to system admin
    await adminClient.updateUserRoles(user.id, 'system_user system_admin');

    const {channelsPage, systemConsolePage, page} = await pw.testBrowser.login(user);

    // # Open the System Console as the admin
    await systemConsolePage.goto();
    await systemConsolePage.toBeVisible();

    // # Demote the user back to a regular member
    await adminClient.updateUserRoles(user.id, 'system_user');

    // # Reload the console after the role change
    await page.reload();

    // * Verify the user no longer has console access and is returned to the channel view
    await channelsPage.toBeVisible();
    await expect.poll(() => page.url(), {timeout: pw.duration.ten_sec}).not.toContain('/admin_console');
});
