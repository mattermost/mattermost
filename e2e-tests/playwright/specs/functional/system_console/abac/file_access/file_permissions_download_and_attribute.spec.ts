// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    createPrivateChannelForABAC,
    createPermissionPolicy,
    enableUserManagedAttributes,
    navigateToPermissionPoliciesPage,
} from '../support';

import {cleanupPermissionPolicyAfterEach, setupUserAndChannel, type PermissionPolicyCleanupState} from './support';

// ─── Download Enforcement ────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Download File Enforcement', () => {
    const cleanup: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};

    test.afterEach(cleanupPermissionPolicyAfterEach(cleanup));

    test('MM-T5820 user denied download sees redacted placeholder instead of file', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File attachment post', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup.lastPolicyName = `Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup.lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 15000});
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toContainText('Files not available');
        await expect(deniedPage.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();
    });

    test('MM-T5821 user sees file normally when no download restriction policy exists', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        // cleanup.lastPolicyName is '' here — no policy to create, beforeEach cleaned any stale one
        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File attachment post', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await systemConsolePage.page.waitForTimeout(1000);

        const {channelsPage: userChannelsPage, page: userPage} = await pw.testBrowser.login(testUser);
        await userChannelsPage.goto(team.name, channelName);
        await userChannelsPage.toBeVisible();

        await expect(userPage.locator('[data-testid="fileAttachmentList"]')).toBeVisible({timeout: 15000});
        await expect(userPage.getByTestId('redactedFilesPlaceholder')).not.toBeVisible();
    });
});

// ─── Attribute-Based Policy — Matching User ───────────────────────────────────

test.describe('ABAC Permission Policies - Attribute-Based Access', () => {
    const cleanup2: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};

    test.afterEach(cleanupPermissionPolicyAfterEach(cleanup2));

    test('MM-T5826 user with matching attribute is granted download access by attribute-based policy', async ({pw}) => {
        test.setTimeout(300000);
        await pw.skipIfNoLicense();

        // Wait 31 seconds to guarantee the server-side AttributeView 30-second
        // refresh gate has expired before creating users with attributes.
        await new Promise((resolve) => setTimeout(resolve, 31000));

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup2.savedAdminClient = adminClient;

        await enableUserManagedAttributes(adminClient);
        const departmentAttr: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttr);

        const userAllowed = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        const userDenied = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        await adminClient.addToTeam(team.id, userAllowed.id);
        await adminClient.addToTeam(team.id, userDenied.id);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(userAllowed.id, channel.id);
        await adminClient.addToChannel(userDenied.id, channel.id);
        const channelName = channel.name;

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File attachment post', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup2.lastPolicyName = `Dept Download Policy ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup2.lastPolicyName,
            celExpression: 'user.attributes.Department == "Engineering"',
            permissions: ['Download Files'],
        });

        // DENIED: Sales user does not match → placeholder shown
        const {page: deniedPage, channelsPage: deniedChannelsPage} = await pw.testBrowser.login(userDenied as any);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 15000});
        await expect(deniedPage.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();

        // ALLOWED: Engineering user matches → file card visible
        const {page: allowedPage, channelsPage: allowedChannelsPage} = await pw.testBrowser.login(userAllowed as any);
        await allowedChannelsPage.goto(team.name, channelName);
        await allowedChannelsPage.toBeVisible();
        await expect(allowedPage.locator('[data-testid="fileAttachmentList"]')).toBeVisible({timeout: 15000});
        await expect(allowedPage.getByTestId('redactedFilesPlaceholder')).not.toBeVisible();
    });
});
