// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {getAsset} from '../../../../../asset';
import {createPermissionPolicy, navigateToPermissionPoliciesPage} from '../support';

import {cleanupPermissionPolicyAfterEach, setupUserAndChannel, type PermissionPolicyCleanupState} from './support';

// ─── Upload Enforcement ──────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Upload File Enforcement', () => {
    const cleanup: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};

    test.afterEach(cleanupPermissionPolicyAfterEach(cleanup));

    test('MM-T5822 user denied upload sees error when attempting file attachment', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup.lastPolicyName = `Upload Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup.lastPolicyName,
            celExpression: 'false',
            permissions: ['Upload Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        deniedPage.once('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(getAsset('mattermost.png'));
        });
        await deniedChannelsPage.centerView.postCreate.attachmentButton.click();

        await expect(deniedPage.getByText(/required access to upload/i)).toBeVisible({timeout: 15000});
        // error text already asserted above
    });

    test('MM-T5823 user can attach and send a file when no upload restriction policy exists', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: userChannelsPage, page: userPage} = await pw.testBrowser.login(testUser);
        await userChannelsPage.goto(team.name, channelName);
        await userChannelsPage.toBeVisible();
        await userChannelsPage.centerView.postCreate.postMessage('Upload test', ['sample_text_file.txt']);

        await expect(userPage.getByText(/required access to upload/i)).not.toBeVisible();
        await expect(userPage.locator('[data-testid="fileAttachmentList"]').last()).toBeVisible({timeout: 15000});
    });
});
