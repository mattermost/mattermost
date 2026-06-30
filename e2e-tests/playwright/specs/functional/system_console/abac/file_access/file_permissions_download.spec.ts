// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, getAdminClient, TestBrowser, getRandomId} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    createUserForABAC,
    createPrivateChannelForABAC,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    enableUserManagedAttributes,
    navigateToPermissionPoliciesPage,
} from '../support';

import {setupUserAndChannel} from './helpers';

/**
 * ABAC Permission Policies - Download File Runtime Enforcement (MM-64508)
 *
 * Tests that permission policies for download_file_attachment are correctly
 * enforced in the channel UI. Covers the straightforward deny/allow pair, the
 * attribute-matching flow, and the Burn-on-Read + permalink edge cases.
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
            adminClient,
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

// ─── Attribute-Based Policy — Matching User ───────────────────────────────────

/**
 * MM-T5826 split into two tests (_a denied, _b allowed) that share a
 * beforeAll. The beforeAll pays the 31-second AttributeView gate plus the
 * policy-creation UI work ONCE. Each test then just logs the relevant user
 * in and asserts the file visibility.
 */
test.describe('ABAC Permission Policies - Attribute-Based Access - MM-T5826', () => {
    let sharedAdminClient: any = null;
    let sharedPolicyName = '';
    let sharedTeam: any;
    let sharedChannelName = '';
    let userAllowed: Awaited<ReturnType<typeof createUserForABAC>>;
    let userDenied: Awaited<ReturnType<typeof createUserForABAC>>;
    let licensed = true;
    let sharedTestBrowser: TestBrowser | null = null;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(240000);

        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found — cannot proceed with ABAC file-access tests');
        }
        sharedAdminClient = adminClient;

        try {
            const lic = await adminClient.getClientLicenseOld();
            if (!lic || lic.IsLicensed !== 'true') {
                licensed = false;
                return;
            }
        } catch {
            licensed = false;
            return;
        }

        // Wait 31s to guarantee the server-side AttributeView 30-second refresh
        // gate has expired before creating users with attributes.
        await new Promise((resolve) => setTimeout(resolve, 31000));

        await enableUserManagedAttributes(adminClient);
        const departmentAttr: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttr);

        userAllowed = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        userDenied = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        const suffix = getRandomId();
        sharedTeam = await adminClient.createTeam({
            name: `abac-dl-${suffix}`,
            display_name: `ABAC-DL ${suffix}`,
            type: 'O',
        } as any);

        await adminClient.addToTeam(sharedTeam.id, userAllowed.id);
        await adminClient.addToTeam(sharedTeam.id, userDenied.id);

        const channel = await createPrivateChannelForABAC(adminClient, sharedTeam.id);
        await adminClient.addToChannel(userAllowed.id, channel.id);
        await adminClient.addToChannel(userDenied.id, channel.id);
        sharedChannelName = channel.name;

        sharedTestBrowser = new TestBrowser(browser);

        // Admin posts a file in the channel via the UI.
        const {channelsPage: adminChannelsPage} = await sharedTestBrowser.login(adminUser);
        await adminChannelsPage.goto(sharedTeam.name, sharedChannelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage('File attachment post', ['sample_text_file.txt']);

        // Admin opens system console, creates the attribute-based download policy.
        const {systemConsolePage} = await sharedTestBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        sharedPolicyName = `Dept Download Policy ${getRandomId()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: sharedPolicyName,
            celExpression: 'user.attributes.Department == "Engineering"',
            permissions: ['Download Files'],
            adminClient: sharedAdminClient,
        });
    });

    test.afterAll(async () => {
        if (sharedPolicyName && sharedAdminClient) {
            await deletePermissionPolicyByName(sharedAdminClient, sharedPolicyName).catch(() => {});
        }
        await sharedTestBrowser?.close().catch(() => {});
    });

    test('MM-T5826_a user without matching attribute is denied download (Sales → placeholder)', async ({pw}) => {
        test.setTimeout(60000);
        test.skip(!licensed, 'No ABAC license');

        const {page, channelsPage} = await pw.testBrowser.login(userDenied as any);
        await channelsPage.goto(sharedTeam.name, sharedChannelName);
        await channelsPage.toBeVisible();
        await expect
            .poll(() => page.getByTestId('redactedFilesPlaceholder').isVisible(), {
                timeout: 45000,
                intervals: [500, 1500, 3000],
            })
            .toBe(true);
        await expect(page.locator('[data-testid="fileAttachmentList"]')).not.toBeVisible();
    });

    test('MM-T5826_b user with matching attribute is granted download (Engineering → file visible)', async ({pw}) => {
        test.setTimeout(60000);
        test.skip(!licensed, 'No ABAC license');

        const {page, channelsPage} = await pw.testBrowser.login(userAllowed as any);
        await channelsPage.goto(sharedTeam.name, sharedChannelName);
        await channelsPage.toBeVisible();
        await expect
            .poll(() => page.locator('[data-testid="fileAttachmentList"]').isVisible(), {
                timeout: 45000,
                intervals: [500, 1500, 3000],
            })
            .toBe(true);
        await expect(page.getByTestId('redactedFilesPlaceholder')).not.toBeVisible();
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
            adminClient,
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
            adminClient,
            name: lastPolicyName,
            celExpression: 'false',
            permissions: ['Download Files'],
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
