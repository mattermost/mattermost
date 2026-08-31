// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, test, enableABAC, getAdminClient, getRandomId, TestBrowser} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createPermissionPolicy,
    createPrivateChannelForABAC,
    createUserForABAC,
    deletePermissionPolicyByName,
    enableUserManagedAttributes,
    navigateToPermissionPoliciesPage,
    updatePermissionPolicyExpression,
} from '../support';

import {ensureABACEnabled, waitForPolicy} from './helpers';

// Each test adds a member, and each addition appends a join system message after the fixture
// post, so the post under test is never the last one.
const FIXTURE_MESSAGE = 'File for live tests';

const GRANTING_EXPRESSION = 'user.attributes.Department == "Engineering"';
const REVOKING_EXPRESSION = 'user.attributes.Department == "Finance"';

// Access changes reaching an already-open page. Two triggers, two websocket events: an
// attribute change sends custom_profile_attributes_values_updated, a policy edit sends
// permission_policy_updated. Each test creates its own user so a revoke cannot leak.
test.describe('ABAC file permissions - live updates', () => {
    let sharedAdminClient: Client4;
    let policyName = '';
    let team: any;
    let channelName = '';
    let channelId = '';
    let attributeFieldsMap: Record<string, any>;
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
        attributeFieldsMap = await setupCustomProfileAttributeFields(adminClient, departmentAttr);

        const suffix = getRandomId();
        team = await adminClient.createTeam({
            name: `abac-live-${suffix}`,
            display_name: `ABAC Live ${suffix}`,
            type: 'O',
        } as any);

        const channel = await createPrivateChannelForABAC(adminClient, team.id);
        channelName = channel.name;
        channelId = channel.id;

        sharedBrowser = new TestBrowser(browser);

        // ABAC off while the admin posts the fixture file, so a policy left behind by an
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

        policyName = `Dept Live Policy ${getRandomId()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: GRANTING_EXPRESSION,
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
     * Create a user who currently satisfies the policy and drop them into the fixture channel.
     * Each test gets its own so that revoking access is not visible to the others.
     */
    async function createAllowedMember() {
        const user = await createUserForABAC(sharedAdminClient, attributeFieldsMap, [
            {name: 'Department', type: 'text', value: 'Engineering'},
        ]);
        await sharedAdminClient.addToTeam(team.id, user.id);
        await sharedAdminClient.addToChannel(user.id, channelId);
        return user;
    }

    /** Move a user out of the department the policy grants access to. */
    async function revokeByAttribute(userId: string) {
        await setupCustomProfileAttributeValuesForUser(
            sharedAdminClient,
            [{name: 'Department', type: 'text', value: 'Sales'}],
            attributeFieldsMap,
            userId,
        );
    }

    /**
     * @objective Verify the upload control flips from enabled to disabled on an open page when
     * the user's attributes stop satisfying the policy, without a reload.
     *
     * @precondition
     * A licensed server with a permission policy granting Upload Files to Department == "Engineering"
     */
    test(
        'disables the upload control on an open page when the user attribute changes',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # A user who currently matches the policy opens the channel
            const user = await createAllowedMember();
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify upload starts out available
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });

            // # Admin moves the user out of the granted department
            await revokeByAttribute(user.id);

            // * Verify the control becomes unavailable without the page being reloaded
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled({
                timeout: pw.duration.half_min,
            });
        },
    );

    /**
     * @objective Verify file attachments already rendered on screen are replaced by the redacted
     * placeholder when the user's attributes stop satisfying the policy, without a reload.
     *
     * @precondition
     * A licensed server with a permission policy granting Download Files to Department == "Engineering"
     */
    test(
        'redacts files already on screen when the user attribute changes',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # A user who currently matches the policy opens the channel
            const user = await createAllowedMember();
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify the file starts out visible
            const post = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await post.toHaveFilesVisible();

            // # Admin moves the user out of the granted department
            await revokeByAttribute(user.id);

            // * Verify the already-loaded post is re-rendered as redacted, with no reload
            await post.toHaveFilesRedacted();
        },
    );

    /**
     * @objective Verify a revoked user stays revoked across a reload — the post-list ETag epoch
     * moved, so the refetch cannot be served from a cache populated while access was allowed.
     *
     * @precondition
     * A licensed server with a permission policy granting both file permissions to Department == "Engineering"
     */
    test(
        'keeps files redacted and upload blocked after a page reload',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # A user who currently matches the policy opens the channel
            const user = await createAllowedMember();
            const {channelsPage, page} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify access starts out granted
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });
            const post = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await post.toHaveFilesVisible();

            // # Admin revokes access, then the user reloads
            await revokeByAttribute(user.id);
            await page.reload();
            await channelsPage.toBeVisible();

            // * Verify the fresh fetch is sanitized rather than served from the stale cache
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled({
                timeout: pw.duration.half_min,
            });
            const reloadedPost = await channelsPage.centerView.getPostByText(FIXTURE_MESSAGE);
            await reloadedPost.toHaveFilesRedacted();
        },
    );

    /**
     * @objective Verify editing the policy itself — rather than the user's attributes — reaches
     * an already-open page and withdraws the upload affordance.
     *
     * Distinct path from the tests above: a policy edit is broadcast system-wide as
     * permission_policy_updated, with no per-user event to key off.
     *
     * Revokes by narrowing the rule's expression, not by removing the action. An action that no
     * rule grants is implicitly allowed, so dropping it from the policy would widen access.
     *
     * @precondition
     * A licensed server with a permission policy granting both file permissions to Department == "Engineering"
     */
    test(
        'disables the upload control on an open page when the policy stops matching the user',
        {tag: '@abac_file_permissions'},
        async ({pw}) => {
            test.setTimeout(pw.duration.two_min);

            // # A user who matches the policy opens the channel
            const user = await createAllowedMember();
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // * Verify upload starts out available
            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });

            // # Restore the fixture even if the assertion below fails, so the shared policy does
            // not leak a revoking expression into the tests that run after this one.
            try {
                // # Admin repoints the policy at a department the user is not in, leaving the
                // user's own attributes untouched
                await updatePermissionPolicyExpression(sharedAdminClient, policyName, REVOKING_EXPRESSION);

                // * Verify the upload affordance is withdrawn without the page being reloaded
                await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled({
                    timeout: pw.duration.half_min,
                });
            } finally {
                await updatePermissionPolicyExpression(sharedAdminClient, policyName, GRANTING_EXPRESSION);
            }
        },
    );
});
