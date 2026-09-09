// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, test, enableABAC, getAdminClient, getRandomId, TestBrowser} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    cleanupAllPermissionPolicies,
    createPermissionPolicy,
    createPrivateChannelForABAC,
    createUserForABAC,
    deletePermissionPolicyByName,
    enableUserManagedAttributes,
    navigateToPermissionPoliciesPage,
} from '../support';

import {ensureABACEnabled, setupUserAndChannel, waitForPolicy} from './helpers';

// Targeted by text, not position: joining a channel appends a system message and later tests
// append their own posts, so the fixture post is not the last one.
const FIXTURE_MESSAGE = 'File for render tests';
const NO_POLICY_MESSAGE = 'File attachment post';

// Load-time assertions only. Changes to an already-open page live in
// file_permissions_live_updates.spec.ts; non-center-channel surfaces in
// file_permissions_edge_cases.spec.ts.
test.describe('ABAC file permissions - attribute-based policy', () => {
    let sharedAdminClient: Client4;
    let policyName = '';
    let team: any;
    let channelName = '';
    let allowedUser: any;
    let deniedUser: any;
    let licensed = true;
    let sharedBrowser: TestBrowser | null = null;

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

        await enableUserManagedAttributes(adminClient);
        const departmentAttr: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttr);

        allowedUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        deniedUser = await createUserForABAC(adminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Sales'},
        ]);

        const suffix = getRandomId();
        team = await adminClient.createTeam({
            name: `abac-render-${suffix}`,
            display_name: `ABAC Render ${suffix}`,
            type: 'O',
        } as any);
        await adminClient.addToTeam(team.id, allowedUser.id);
        await adminClient.addToTeam(team.id, deniedUser.id);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        channelName = channel.name;
        await adminClient.addToChannel(allowedUser.id, channel.id);
        await adminClient.addToChannel(deniedUser.id, channel.id);

        sharedBrowser = new TestBrowser(browser);

        // Turn ABAC off while the admin posts the fixture file, so a policy left behind by an
        // earlier spec cannot block the upload this whole describe depends on.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        } as any);

        const {channelsPage: adminChannelsPage} = await sharedBrowser.login(adminUser);
        await adminChannelsPage.goto(team.name, channelName);
        await adminChannelsPage.toBeVisible();
        await adminChannelsPage.centerView.postCreate.postMessage(FIXTURE_MESSAGE, ['sample_text_file.txt']);

        const {systemConsolePage} = await sharedBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        policyName = `Dept Render Policy ${getRandomId()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: 'user.attributes.Department == "Engineering"',
            permissions: ['Upload Files', 'Download Files'],
            adminClient,
        });
        await waitForPolicy(adminClient, policyName);
    });

    test.beforeEach(async () => {
        test.skip(!licensed, 'No ABAC license');
        await ensureABACEnabled(sharedAdminClient);
    });

    test.afterAll(async () => {
        if (policyName && sharedAdminClient) {
            await deletePermissionPolicyByName(sharedAdminClient, policyName).catch(() => {});
        }
        await sharedBrowser?.close().catch(() => {});
    });

    /**
     * @objective Verify a user whose attributes satisfy the policy sees real file attachments.
     *
     * @precondition
     * A licensed server with a permission policy granting Download Files to Department == "Engineering"
     */
    test(
        'MM-T5826_b shows file attachments to a user whose attributes match the policy',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.one_min);

            // # Log in as the user whose Department matches the policy
            const {channelsPage} = await pw.testBrowser.login(allowedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the post renders its real attachments, not the redacted placeholder
            const post = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await post.toHaveFilesVisible();
        },
    );

    /**
     * @objective Verify a user whose attributes fail the policy sees the redacted placeholder
     * instead of the file.
     *
     * @precondition
     * A licensed server with a permission policy granting Download Files to Department == "Engineering"
     */
    test(
        'MM-T5826_a redacts file attachments for a user whose attributes fail the policy',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.one_min);

            // # Log in as the user whose Department does not match the policy
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the file is replaced by the redacted placeholder
            const post = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await post.toHaveFilesRedacted();
            await expect(post.redactedFilesPlaceholder).toContainText('Files not available');
        },
    );

    /**
     * @objective Verify the upload affordance is offered to a user whose attributes satisfy the policy.
     *
     * @precondition
     * A licensed server with a permission policy granting Upload Files to Department == "Engineering"
     */
    test(
        'enables the upload control for a user whose attributes match the policy',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.one_min);

            // # Log in as the user whose Department matches the policy
            const {channelsPage} = await pw.testBrowser.login(allowedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the attachment control is offered
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });
        },
    );

    /**
     * @objective Verify the upload affordance is disabled rather than hidden for a user whose
     * attributes fail the policy, so the restriction is visible instead of surfacing as a
     * server error after the fact.
     *
     * @precondition
     * A licensed server with a permission policy granting Upload Files to Department == "Engineering"
     */
    test(
        'MM-T5822 disables the upload control for a user whose attributes fail the policy',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.one_min);

            // # Log in as the user whose Department does not match the policy
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the attachment control stays visible but is not actionable
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeVisible({
                timeout: pw.duration.half_min,
            });
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled();
        },
    );

    /**
     * @objective Verify a single denied user is restricted on both file actions at once — files
     * redacted and upload blocked in the same view.
     *
     * @precondition
     * A licensed server with a permission policy granting both file permissions to Department == "Engineering"
     */
    test(
        'MM-T5824 redacts files and blocks upload together for a denied user',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.one_min);

            // # Log in as the user whose Department does not match the policy
            const {channelsPage} = await pw.testBrowser.login(deniedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify existing files are redacted
            const post = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await post.toHaveFilesRedacted();

            // * Verify new uploads are not offered
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled({
                timeout: pw.duration.half_min,
            });
        },
    );

    /**
     * @objective Verify a rendered "allowed" is backed by live enforcement — the user the UI
     * offers upload to can actually complete one, so the affordance and the server agree.
     *
     * @precondition
     * A licensed server with a permission policy granting Upload Files to Department == "Engineering"
     */
    test(
        'accepts a real upload from a user the render decision allows',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # Log in as the user whose Department matches the policy
            const {channelsPage} = await pw.testBrowser.login(allowedUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });

            // # Upload a file
            const message = `Upload from allowed user ${getRandomId()}`;
            await channelsPage.centerView.postCreate.postMessage(message, ['sample_text_file.txt']);

            // * Verify the post was accepted with its attachment intact
            const post = await channelsPage.centerView.getPostByText(message);
            await post.toContainText(message);
            await post.toHaveFilesVisible();
        },
    );
});

/**
 * With ABAC enabled but no permission policy in existence, every file action is implicitly
 * allowed. Separate fixture from the describe above because it needs the policy table empty.
 */
test.describe('ABAC file permissions - implicit allow with no policy', () => {
    test.beforeEach(async ({pw}) => {
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify existing file attachments render normally when no permission policy
     * restricts the user.
     */
    test(
        'MM-T5821 shows file attachments when no permission policy exists',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # Set up a team, a private channel, and a member of it
            const {adminUser, adminClient, team} = await pw.initSetup();
            const {testUser, channelName} = await setupUserAndChannel(adminClient, team);
            await cleanupAllPermissionPolicies(adminClient);

            // # Admin posts a file into the channel
            const {channelsPage: adminChannelsPage} = await pw.testBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage(NO_POLICY_MESSAGE, ['sample_text_file.txt']);

            // # Enable ABAC without creating any policy
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await ensureABACEnabled(adminClient);

            // # The member opens the channel
            const {channelsPage} = await pw.testBrowser.login(testUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the file renders rather than being redacted
            const post = await channelsPage.centerView.getPostByText(NO_POLICY_MESSAGE);
            await post.toHaveFilesVisible();
        },
    );

    /**
     * @objective Verify a user can attach and send a file when no permission policy restricts
     * uploads.
     */
    test(
        'MM-T5823 accepts a file upload when no permission policy exists',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # Set up a team, a private channel, and a member of it
            const {adminUser, adminClient, team} = await pw.initSetup();
            const {testUser, channelName} = await setupUserAndChannel(adminClient, team);
            await cleanupAllPermissionPolicies(adminClient);

            // # Enable ABAC without creating any policy
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await ensureABACEnabled(adminClient);

            // # The member uploads a file
            const {channelsPage} = await pw.testBrowser.login(testUser);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            const message = `Upload test ${getRandomId()}`;
            await channelsPage.centerView.postCreate.postMessage(message, ['sample_text_file.txt']);

            // * Verify the post was accepted with its attachment intact
            const post = await channelsPage.centerView.getPostByText(message);
            await post.toContainText(message);
            await post.toHaveFilesVisible();
        },
    );
});
