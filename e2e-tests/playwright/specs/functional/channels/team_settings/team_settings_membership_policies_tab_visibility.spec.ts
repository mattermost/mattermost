// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for the Membership Policies tab in Team Settings Modal
 * @reference MM-67669
 */

import {expect, test} from '@mattermost/playwright-lib';

import {loginAndOpenPoliciesTab, loginAndOpenTeamSettings} from './support';

test.describe('Team Settings Modal - Membership Policies Tab', () => {
    test('MM-67669_1 Membership Policies tab visible for admin with ABAC enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();
        const config = {...adminConfig};
        config.AccessControlSettings = {...config.AccessControlSettings, EnableAttributeBasedAccessControl: true};
        await adminClient.updateConfig(config);

        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser);

        // * Both tabs visible
        await expect(teamSettings.accessPoliciesTab).toBeVisible();
        await expect(teamSettings.accessTab).toContainText('Access');

        await teamSettings.close();
    });

    test('MM-67669_2 Membership Policies tab hidden when ABAC disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser} = await pw.initSetup();

        const {teamSettings} = await loginAndOpenTeamSettings(pw, adminUser);

        // * Tab is not visible
        await expect(teamSettings.accessPoliciesTab).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-67669_4 Empty state displayed when no policies exist', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, adminConfig} = await pw.initSetup();
        const config = {...adminConfig};
        config.AccessControlSettings = {...config.AccessControlSettings, EnableAttributeBasedAccessControl: true};
        await adminClient.updateConfig(config);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, adminUser);

        // * Empty state shown
        await expect(teamSettings.container.getByText('No policies found')).toBeVisible();

        // * Sync footer hidden when no policies exist
        await expect(teamSettings.container.locator('.SyncStatusFooter')).not.toBeVisible();

        await teamSettings.close();
    });
});
