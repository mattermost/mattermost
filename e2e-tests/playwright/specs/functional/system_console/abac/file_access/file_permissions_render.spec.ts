// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {
    expect,
    getAdminClient,
    getRandomId,
    openChannel,
    test,
    TestBrowser,
    duration,
    Msg,
} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {
    cleanupAllPermissionPolicies,
    createPrivateChannelForABAC,
    createUserForABAC,
    deletePermissionPolicyByName,
    enableUserManagedAttributes,
    ensureUserAttributes,
} from '../support';
import {createPermissionPolicy, setAbacEnabled} from '../surface';

import {
    ensureABACEnabled,
    expectFilesRedacted,
    expectFilesVisible,
    postNamed,
    postWithFile,
    setupUserAndChannel,
    waitForPolicy,
} from './helpers';

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
    let channelId = '';
    let allowedUser: any;
    let deniedUser: any;
    let licensed = true;
    let sharedBrowser: TestBrowser | null = null;

    test.beforeAll(async ({browser}) => {
        test.setTimeout(duration.four_min);

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
        channelId = channel.id;
        await adminClient.addToChannel(allowedUser.id, channel.id);
        await adminClient.addToChannel(deniedUser.id, channel.id);

        sharedBrowser = new TestBrowser(browser);

        // Turn ABAC off while the admin posts the fixture file, so a policy left behind by an
        // earlier spec cannot block the upload this whole describe depends on.
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: false},
        } as any);

        const {app: adminApp} = await sharedBrowser.login(adminUser);
        await adminApp.channelsPage.goto({team, channel: {name: channelName}});
        await expect(adminApp.center.postCreate.message.container).toBeVisible();
        await postWithFile(adminApp, adminClient, channelId, FIXTURE_MESSAGE);

        await setAbacEnabled(adminApp, true);
        await ensureUserAttributes(adminClient);
        policyName = `Dept Render Policy ${getRandomId()}`;
        await createPermissionPolicy(adminApp, {
            name: policyName,
            cel: 'user.attributes.Department == "Engineering"',
            permissions: ['upload_file_attachment', 'download_file_attachment'],
        });
        await waitForPolicy(adminClient, policyName);
    });

    test.beforeEach(async () => {
        test.skip(!licensed, 'No ABAC license');
        await ensureABACEnabled(sharedAdminClient);
    });

    test.afterAll(async () => {
        if (policyName && sharedAdminClient) {
            await deletePermissionPolicyByName(sharedAdminClient, policyName);
        }
        await sharedBrowser?.close();
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
            const app = await openChannel(pw, allowedUser, {team, channel: {name: channelName}});

            // * Verify the post renders its real attachments, not the redacted placeholder
            const post = await postNamed(app, sharedAdminClient, channelId, FIXTURE_MESSAGE);
            await expectFilesVisible(post);
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
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});

            // * Verify the file is replaced by the redacted placeholder
            const post = await postNamed(app, sharedAdminClient, channelId, FIXTURE_MESSAGE);
            await expectFilesRedacted(post);
            await expect(post.redactedFiles).toContainMessage(Msg.post.redacted_files.title);
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
            const app = await openChannel(pw, allowedUser, {team, channel: {name: channelName}});

            // * Verify the attachment control is offered
            await expect(app.center.postCreate.attachButton).toBeEnabled({
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
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});

            // * Verify the attachment control stays visible but is not actionable
            await expect(app.center.postCreate.attachButton).toBeVisible({
                timeout: pw.duration.half_min,
            });
            await expect(app.center.postCreate.attachButton).toBeDisabled();
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
            const app = await openChannel(pw, deniedUser, {team, channel: {name: channelName}});

            // * Verify existing files are redacted
            const post = await postNamed(app, sharedAdminClient, channelId, FIXTURE_MESSAGE);
            await expectFilesRedacted(post);

            // * Verify new uploads are not offered
            await expect(app.center.postCreate.attachButton).toBeDisabled({
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
            const app = await openChannel(pw, allowedUser, {team, channel: {name: channelName}});
            await expect(app.center.postCreate.attachButton).toBeEnabled({
                timeout: pw.duration.half_min,
            });

            // # Upload a file
            const message = `Upload from allowed user ${getRandomId()}`;
            const post = await postWithFile(app, sharedAdminClient, channelId, message);

            // * Verify the post was accepted with its attachment intact
            await expect(post).toContainText(message);
            await expectFilesVisible(post);
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
            const {testUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);
            await cleanupAllPermissionPolicies(adminClient);

            // # Admin posts a file into the channel
            const adminApp = await openChannel(pw, adminUser, {team, channel: {name: channelName}});
            await postWithFile(adminApp, adminClient, channelId, NO_POLICY_MESSAGE);

            // # Enable ABAC without creating any policy
            await setAbacEnabled(adminApp, true);
            await ensureABACEnabled(adminClient);

            // # The member opens the channel
            const app = await openChannel(pw, testUser, {team, channel: {name: channelName}});

            // * Verify the file renders rather than being redacted
            const post = await postNamed(app, adminClient, channelId, NO_POLICY_MESSAGE);
            await expectFilesVisible(post);
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
            const {testUser, channelName, channelId} = await setupUserAndChannel(adminClient, team);
            await cleanupAllPermissionPolicies(adminClient);

            // # Enable ABAC without creating any policy
            const {app: adminApp} = await pw.testBrowser.login(adminUser);
            await setAbacEnabled(adminApp, true);
            await ensureABACEnabled(adminClient);

            // # The member uploads a file
            const app = await openChannel(pw, testUser, {team, channel: {name: channelName}});
            const message = `Upload test ${getRandomId()}`;
            const post = await postWithFile(app, adminClient, channelId, message);

            // * Verify the post was accepted with its attachment intact
            await expect(post).toContainText(message);
            await expectFilesVisible(post);
        },
    );
});
