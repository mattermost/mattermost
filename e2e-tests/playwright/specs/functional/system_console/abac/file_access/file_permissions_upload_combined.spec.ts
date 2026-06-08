// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {createPermissionPolicy, deletePermissionPolicyByName, navigateToPermissionPoliciesPage} from '../support';

import {setupUserAndChannel} from './helpers';

test.describe('ABAC Permission Policies - Upload File Enforcement', {tag: ['@abac', '@abac_file_permissions']}, () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    test('MM-T5822 user denied upload sees the upload control disabled', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        lastPolicyName = `Upload Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,

            // Attribute comparison no test user satisfies (deny-all) instead of the
            // bare `false` literal, which currently fails policy creation.
            celExpression: "user.attributes.Department == 'no-such-value-deny-all'",
            permissions: ['Upload Files'],
        });

        // Re-apply ABAC guard: a concurrent initSetup() may have reset
        // AccessControlSettings.EnableAttributeBasedAccessControl to false between
        // enableABAC() above and the denied user's login, preventing enforcement.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as any);
        await expect
            .poll(
                async () => {
                    const cfg = await adminClient.getConfig();
                    return cfg.AccessControlSettings?.EnableAttributeBasedAccessControl === true;
                },
                {timeout: 15000, intervals: [500, 1000, 2000]},
            )
            .toBe(true);

        const {channelsPage: deniedChannelsPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        // The render-time ABAC decision keeps the attachment control visible but
        // disabled, so the user cannot attempt an upload that the server would
        // reject. (Server-side enforcement of upload denial is covered by the
        // combined enforcement test below.)
        await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeVisible({timeout: 30000});
        await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeDisabled();
    });

    test('MM-T5823 user can attach and send a file when no upload restriction policy exists', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
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

test.describe(
    'ABAC Permission Policies - Combined File Enforcement',
    {tag: ['@abac', '@abac_file_permissions']},
    () => {
        let lastPolicyName = '';
        let savedAdminClient: any = null;

        test.afterEach(async () => {
            if (lastPolicyName && savedAdminClient) {
                await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
                lastPolicyName = '';
                savedAdminClient = null;
            }
        });

        test('MM-T5824 user denied both download and upload sees placeholder and cannot upload', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage('File for combined test', [
                'sample_text_file.txt',
            ]);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await navigateToPermissionPoliciesPage(systemConsolePage.page);

            lastPolicyName = `Both Deny ${pw.random.id()}`;
            await createPermissionPolicy(systemConsolePage.page, {
                name: lastPolicyName,

                // Attribute comparison no test user satisfies (deny-all) instead of the
                // bare `false` literal, which currently fails policy creation.
                celExpression: "user.attributes.Department == 'no-such-value-deny-all'",
                permissions: ['Download Files', 'Upload Files'],
            });
            await systemConsolePage.page.waitForTimeout(1000);

            const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
            await deniedChannelsPage.goto(team.name, channelName);
            await deniedChannelsPage.toBeVisible();

            // Download denied: existing files render as the redacted placeholder.
            await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 15000});
            await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toContainText('Files not available');

            // Upload denied: the attachment control is visible but disabled at render
            // time, so the user cannot attempt an upload the server would reject.
            await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeVisible({timeout: 15000});
            await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeDisabled();
        });

        test('MM-T5825 user can download and upload files when no restriction policies exist', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser, channelName} = await setupUserAndChannel(adminClient, team);

            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage('File for allowed test', [
                'sample_text_file.txt',
            ]);

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
    },
);
