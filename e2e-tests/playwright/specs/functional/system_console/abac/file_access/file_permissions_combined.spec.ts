// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {getAsset} from '../../../../../asset';
import {createPermissionPolicy, navigateToPermissionPoliciesPage} from '../support';

import {cleanupPermissionPolicyAfterEach, setupUserAndChannel, type PermissionPolicyCleanupState} from './support';

// ─── Combined Enforcement ────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Combined File Enforcement', () => {
    const cleanup: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};

    test.afterEach(cleanupPermissionPolicyAfterEach(cleanup));

    test('MM-T5824 user denied both download and upload sees placeholder and cannot upload', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File for combined test', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup.lastPolicyName = `Both Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup.lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files', 'Upload Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 15000});
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toContainText('Files not available');

        deniedPage.once('filechooser', async (fileChooser) => {
            await fileChooser.setFiles(getAsset('mattermost.png'));
        });
        await deniedChannelsPage.centerView.postCreate.attachmentButton.click();
        await expect(deniedPage.getByText(/required access to upload/i)).toBeVisible({timeout: 15000});
        // error text already asserted above
    });

    test('MM-T5825 user can download and upload files when no restriction policies exist', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File for allowed test', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: userChannelsPage, page: userPage} = await pw.testBrowser.login(testUser);
        await userChannelsPage.goto(team.name, channelName);
        await userChannelsPage.toBeVisible();

        await expect(userPage.locator('[data-testid="fileAttachmentList"]')).toBeVisible({timeout: 15000});
        await expect(userPage.getByTestId('redactedFilesPlaceholder')).not.toBeVisible();

        await userChannelsPage.centerView.postCreate.postMessage('Upload from user', ['sample_text_file.txt']);
        await expect(userPage.getByText(/required access to upload/i)).not.toBeVisible();
        await expect(userPage.locator('[data-testid="fileAttachmentList"]').last()).toBeVisible({timeout: 15000});
    });
});
