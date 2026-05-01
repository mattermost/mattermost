// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {getAsset} from '../../../../../asset';
import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    createPrivateChannelForABAC,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    enableUserManagedAttributes,
    ensureUserAttributes,
    navigateToPermissionPoliciesPage,
} from '../support';

/**
 * ABAC Permission Policies - File Access Runtime Enforcement (MM-64508)
 *
 * Tests that permission policies for download_file_attachment and
 * upload_file_attachment are correctly enforced in the channel UI.
 *
 * CEL strategy:
 *   - DENIED tests:  celExpression = 'false'  → unconditional deny, no attribute dependency
 *   - ALLOWED tests: no permission policy created → no-policy = implicit allow
 *
 * Cleanup strategy per describe block:
 *   - `let lastPolicyName` tracks the name of whatever policy the current test created
 *   - `afterEach` deletes it by exact name via deletePermissionPolicyByName (reliable)
 *   - `beforeEach` also deletes by name in case afterEach failed (safety net)
 *   - Individual tests just set lastPolicyName and do NOT do their own cleanup
 */

// ─── Shared setup helper ─────────────────────────────────────────────────────

async function setupUserAndChannel(
    adminClient: any,
    team: any,
): Promise<{
    testUser: any;
    channelName: string;
    channelId: string;
}> {
    // Ensure at least one user attribute field exists so the permission policy
    // CEL editor's "Switch to Advanced Mode" button is enabled in the UI.
    await ensureUserAttributes(adminClient, ['Department']);

    const randomId = Math.random().toString(36).substring(2, 9);
    const username = `user${randomId}`;
    const testUser = await adminClient.createUser(
        {email: `${username}@example.com`, username, password: 'Passwd4Testing!'} as any,
        '',
        '',
    );
    (testUser as any).password = 'Passwd4Testing!';

    await adminClient.addToTeam(team.id, testUser.id);

    const channel = await createPrivateChannelForABAC(adminClient, team.id);
    await adminClient.addToChannel(testUser.id, channel.id);

    return {testUser, channelName: channel.name, channelId: channel.id};
}

// ─── Download Enforcement ────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Download File Enforcement', () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    test('MM-T5820 user denied download sees redacted placeholder instead of file', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

        const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File attachment post', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        lastPolicyName = `Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
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

        // lastPolicyName is '' here — no policy to create, beforeEach cleaned any stale one
        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
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

// ─── Upload Enforcement ──────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Upload File Enforcement', () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    test('MM-T5822 user denied upload sees error when attempting file attachment', async ({pw}) => {
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

// ─── Combined Enforcement ────────────────────────────────────────────────────

test.describe('ABAC Permission Policies - Combined File Enforcement', () => {
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
        await adminChannelsPage.centerView.postCreate.postMessage('File for combined test', ['sample_text_file.txt']);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        lastPolicyName = `Both Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
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
        savedAdminClient = adminClient;
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

// ─── Attribute-Based Policy — Matching User ───────────────────────────────────

test.describe('ABAC Permission Policies - Attribute-Based Access', () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    test('MM-T5826 user with matching attribute is granted download access by attribute-based policy', async ({pw}) => {
        test.setTimeout(300000);
        await pw.skipIfNoLicense();

        // Wait 31 seconds to guarantee the server-side AttributeView 30-second
        // refresh gate has expired before creating users with attributes.
        await new Promise((resolve) => setTimeout(resolve, 31000));

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;

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

        lastPolicyName = `Dept Download Policy ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
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

// ─── Burn-on-Read and Permalink Edge Cases ────────────────────────────────────

test.describe('ABAC Permission Policies - BOR and Permalink', () => {
    let lastPolicyName = '';
    let savedAdminClient: any = null;

    test.afterEach(async () => {
        if (lastPolicyName && savedAdminClient) {
            await deletePermissionPolicyByName(savedAdminClient, lastPolicyName);
            lastPolicyName = '';
            savedAdminClient = null;
        }
    });

    test('MM-T5827 denied user reveals BOR message with attachment and sees redacted placeholder', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
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

        lastPolicyName = `BOR Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
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
        savedAdminClient = adminClient;
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

        lastPolicyName = `Permalink Download Deny ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files'],
        });
        await systemConsolePage.page.waitForTimeout(1000);

        // # Denied user loads the channel
        const {channelsPage: deniedChannelsPage, page: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedChannelsPage.goto(team.name, channelName);
        await deniedChannelsPage.toBeVisible();

        // * The standalone original post shows the placeholder (files redacted at top level)
        await expect(deniedPage.getByTestId('redactedFilesPlaceholder').first()).toBeVisible({timeout: 15000});

        // * The embedded permalink preview (.post-preview) must ALSO show the placeholder —
        // this specifically validates that the fix strips files from the embedded post
        // and sets RedactedFileCount, causing the placeholder to render inside the embed.
        const permalinkEmbed = deniedPage.locator('.post-preview');
        await expect(permalinkEmbed).toBeVisible({timeout: 15000});
        await expect(permalinkEmbed.getByTestId('redactedFilesPlaceholder')).toBeVisible({timeout: 10000});

        // * No file attachment card anywhere in the channel view
        await expect(deniedPage.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();
    });
});
