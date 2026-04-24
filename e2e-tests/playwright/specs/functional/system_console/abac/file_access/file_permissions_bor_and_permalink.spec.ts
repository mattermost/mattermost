// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {createPermissionPolicy, navigateToPermissionPoliciesPage} from '../support';

import {cleanupPermissionPolicyAfterEach, setupUserAndChannel, type PermissionPolicyCleanupState} from './support';

// ─── Burn-on-Read and Permalink Edge Cases ────────────────────────────────────

test.describe('ABAC Permission Policies - BOR and Permalink', () => {
    const cleanup: PermissionPolicyCleanupState = {lastPolicyName: '', savedAdminClient: null};

    test.afterEach(cleanupPermissionPolicyAfterEach(cleanup));

    test('MM-T5827 denied user reveals BOR message with attachment and sees redacted placeholder', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        // # Admin sends a Burn-on-Read message with a file attachment
        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.toggleBurnOnRead();
        await adminChannelsPage.centerView.postCreate.postMessage('BOR with file', ['sample_text_file.txt']);

        // # Enable ABAC and create a policy that unconditionally denies download
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup.lastPolicyName = `BOR Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup.lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        // # Denied user navigates to channel and reveals the BOR message
        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        const concealedPlaceholder = deniedPage.locator('.BurnOnReadConcealedPlaceholder').first();
        await expect(concealedPlaceholder).toBeVisible({timeout: 15000});
        await concealedPlaceholder.click();

        // Confirm the reveal modal if it appears
        const confirmModal = deniedPage.locator('.BurnOnReadConfirmationModal');
        if (await confirmModal.isVisible({timeout: 3000}).catch(() => false)) {
            await confirmModal.getByRole('button', {name: /reveal/i}).click();
        }

        // * After reveal the API applies ABAC sanitization — placeholder shown, no file card
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 15000});
        await expect(deniedPage.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();
    });

    test('MM-T5828 denied user sees no file preview inside a permalink to a post with attachment', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanup.savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);

        // # Admin posts a message with a file attachment
        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('original with file', ['sample_text_file.txt']);

        // # Retrieve the post ID and construct the permalink URL
        const postsResult = await adminClient.getPosts(channelId, 0, 1);
        const postId = postsResult.order[0];
        const serverUrl = adminClient.getBaseRoute().replace('/api/v4', '');
        const permalinkUrl = `${serverUrl}/${team.name}/pl/${postId}`;

        // # Admin posts the permalink in the same channel (creates an embedded preview)
        await adminChannelsPage.centerView.postCreate.postMessage(permalinkUrl);

        // # Enable ABAC and create a policy that unconditionally denies download
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        cleanup.lastPolicyName = `Permalink Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: cleanup.lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        // # Denied user loads the channel
        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        // * The permalink preview embeds the referenced post — file must be redacted.
        // Both the standalone post and the embedded preview should show the placeholder.
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder').first()).toBeVisible({timeout: 15000});

        // * No file attachment card anywhere in the channel view
        await expect(deniedPage.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();
    });
});
