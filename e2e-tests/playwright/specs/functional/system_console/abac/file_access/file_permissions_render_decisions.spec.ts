// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, getAdminClient, getRandomId, TestBrowser} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {
    setupCustomProfileAttributeFields,
    setupCustomProfileAttributeValuesForUser,
} from '../../../channels/custom_profile_attributes/helpers';
import {
    createPermissionPolicy,
    deletePermissionPolicyByName,
    navigateToPermissionPoliciesPage,
    createUserForABAC,
    createPrivateChannelForABAC,
    enableUserManagedAttributes,
} from '../support';

import {setupUserAndChannel} from './helpers';

// These specs cover the RENDER-TIME behavior of ABAC file permissions: the
// upload control is shown or hidden based on a server-computed render decision
// (Action Search), BEFORE the user attempts an action. This is distinct from the
// enforcement specs in file_permissions_upload_combined.spec.ts, which verify the
// server rejects an attempted upload.
test.describe(
    'ABAC Permission Policies - Render-time upload affordance',
    {tag: ['@abac', '@abac_file_permissions', '@abac_render_decisions']},
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

        test('upload control is disabled at render time when policy denies upload', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser: deniedUser, channelName} = await setupUserAndChannel(adminClient, team);

            // # Admin enables ABAC and creates an upload-deny policy (deny everyone).
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await navigateToPermissionPoliciesPage(systemConsolePage.page);

            lastPolicyName = `Upload Deny ${pw.random.id()}`;
            await createPermissionPolicy(systemConsolePage.page, {
                name: lastPolicyName,

                // Deny-all expressed as an attribute comparison no test user satisfies,
                // rather than the bare `false` literal (which currently fails policy
                // creation). Test users are created without a Department value.
                celExpression: "user.attributes.Department == 'no-such-value-deny-all'",
                permissions: ['Upload Files'],
            });

            // # Re-apply the ABAC guard in case a concurrent setup reset it.
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

            // # The denied user opens the channel.
            const {channelsPage: deniedChannelsPage} = await pw.testBrowser.login(deniedUser);
            await deniedChannelsPage.goto(team.name, channelName);
            await deniedChannelsPage.toBeVisible();

            // * The upload (attachment) control stays visible but is disabled, so the
            // user sees the affordance is restricted rather than clicking and getting
            // a server error after the fact.
            await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeVisible({timeout: 30000});
            await expect(deniedChannelsPage.centerView.postCreate.attachmentButton).toBeDisabled();
        });

        test('upload control is visible when no upload policy restricts the user', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            const {adminUser, adminClient, team} = await pw.initSetup();
            savedAdminClient = adminClient;
            const {testUser, channelName} = await setupUserAndChannel(adminClient, team);

            // # Admin enables ABAC but creates no upload policy (implicit allow).
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);

            // # The user opens the channel.
            const {channelsPage: userChannelsPage} = await pw.testBrowser.login(testUser);
            await userChannelsPage.goto(team.name, channelName);
            await userChannelsPage.toBeVisible();

            // * The upload control renders normally.
            await expect(userChannelsPage.centerView.postCreate.attachmentButton).toBeVisible({timeout: 30000});
        });
    },
);

// Attribute-based and LIVE render-decision behavior. These exercise the full
// architecture: a CEL policy keyed on a user attribute, the render decision
// reflecting it at load, and — critically — the decision updating WITHOUT a
// reload when the user's attribute changes (which fires the
// custom_profile_attributes_values_updated event the webapp listens to and
// reconciles from).
//
// UpsertPropertyValues now calls invalidateAttributeViewCache() on every CPA
// write, so the server-side AttributeView is refreshed on the next evaluation
// request rather than waiting for the 30s throttle window. Live updates
// therefore reflect within a few seconds of the attribute change.
//
// A single policy grants both upload and download to Department == "Engineering".
test.describe(
    'ABAC Permission Policies - Render-time attribute-based & live updates',
    {tag: ['@abac', '@abac_file_permissions', '@abac_render_decisions']},
    () => {
        let sharedAdminClient: any = null;
        let policyName = '';
        let team: any;
        let channelName = '';
        let channelId = '';
        let attributeFieldsMap: Record<string, any>;
        let allowedUser: Awaited<ReturnType<typeof createUserForABAC>>;
        let deniedUser: Awaited<ReturnType<typeof createUserForABAC>>;
        let licensed = true;
        let sharedBrowser: TestBrowser | null = null;

        test.beforeAll(async ({browser}) => {
            test.setTimeout(180000);

            const {adminClient, adminUser} = await getAdminClient();
            if (!adminUser) {
                throw new Error('Admin user not found — cannot proceed with ABAC render tests');
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

            // UpsertPropertyValues calls invalidateAttributeViewCache() on each write,
            // so the AttributeView is fresh on the next evaluation — no 30s wait needed.
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

            // Reset to a known state before setup: ABAC off so the admin's file
            // upload is not affected by any policy from previously-run test suites.
            await adminClient.patchConfig({
                AccessControlSettings: {EnableAttributeBasedAccessControl: false},
            } as any);

            // Admin posts a file (used by the download-redaction tests).
            const {channelsPage: adminChannelsPage} = await sharedBrowser.login(adminUser);
            await adminChannelsPage.goto(team.name, channelName);
            await adminChannelsPage.toBeVisible();
            await adminChannelsPage.centerView.postCreate.postMessage('File for render tests', [
                'sample_text_file.txt',
            ]);

            // One policy grants upload + download to Department == "Engineering".
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
        });

        test.afterAll(async () => {
            if (policyName && sharedAdminClient) {
                await deletePermissionPolicyByName(sharedAdminClient, policyName).catch(() => {});
            }
            await sharedBrowser?.close().catch(() => {});
        });

        // (C) Positive attribute-based allow + deny, at render time.
        test('upload control is enabled for a matching attribute and disabled for a non-matching one', async ({pw}) => {
            test.setTimeout(90000);
            test.skip(!licensed, 'No ABAC license');

            const allowed = await pw.testBrowser.login(allowedUser as any);
            await allowed.channelsPage.goto(team.name, channelName);
            await allowed.channelsPage.toBeVisible();
            await expect
                .poll(() => allowed.channelsPage.centerView.postCreate.attachmentButton.isEnabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);

            const denied = await pw.testBrowser.login(deniedUser as any);
            await denied.channelsPage.goto(team.name, channelName);
            await denied.channelsPage.toBeVisible();
            await expect(denied.channelsPage.centerView.postCreate.attachmentButton).toBeVisible({timeout: 30000});
            await expect
                .poll(() => denied.channelsPage.centerView.postCreate.attachmentButton.isDisabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);
        });

        // (D) Render-allow corresponds to a real, server-accepted upload — proving
        // the allow decision is backed by live enforcement, not just UI state.
        test('a user allowed by attribute can actually upload (enforcement accepts)', async ({pw}) => {
            test.setTimeout(90000);
            test.skip(!licensed, 'No ABAC license');

            const {channelsPage, page} = await pw.testBrowser.login(allowedUser as any);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // Wait for the ABAC render decision to resolve before uploading.
            // The button starts disabled while the action-search response is in-flight.
            await expect
                .poll(() => channelsPage.centerView.postCreate.attachmentButton.isEnabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);

            const attachments = page.locator('[data-testid="fileAttachmentList"]');
            const beforeCount = await attachments.count();
            await channelsPage.centerView.postCreate.postMessage('Upload from allowed user', ['sample_text_file.txt']);
            await expect(attachments).toHaveCount(beforeCount + 1, {timeout: 30000});
        });

        // (A) Live: the upload control flips to disabled when the user's attribute
        // changes, without a page reload. invalidateAttributeViewCache() is called on
        // every CPA write, so the next render-decision fetch gets a fresh evaluation
        // instead of waiting for the 30s AttributeView throttle window.
        test('upload control updates live (enabled → disabled) when the user attribute changes', async ({pw}) => {
            test.setTimeout(90000);
            test.skip(!licensed, 'No ABAC license');

            const liveUser = await createUserForABAC(sharedAdminClient, attributeFieldsMap, [
                {name: 'Department', type: 'text', value: 'Engineering'},
            ]);
            await sharedAdminClient.addToTeam(team.id, liveUser.id);
            await sharedAdminClient.addToChannel(liveUser.id, channelId);

            const {channelsPage} = await pw.testBrowser.login(liveUser as any);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // Initially allowed (Engineering) → control enabled.
            await expect
                .poll(() => channelsPage.centerView.postCreate.attachmentButton.isEnabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);

            // Admin revokes by changing the attribute; the CPA update event drives a
            // re-fetch of the render decision on the still-open page.
            await setupCustomProfileAttributeValuesForUser(
                sharedAdminClient,
                [{name: 'Department', type: 'text', value: 'Sales'}],
                attributeFieldsMap,
                liveUser.id,
            );

            await expect
                .poll(() => channelsPage.centerView.postCreate.attachmentButton.isDisabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);
        });

        // (B) File visibility is gated correctly by attribute:
        //   - allowed user (Engineering) sees the file attachment list, no placeholder
        //   - denied user (Sales) sees the redacted placeholder, no file attachment list
        // Tests SanitizePostListMetadataForUser end-to-end: server strips file metadata
        // for denied users and the client renders RedactedFilesPlaceholder in its place.
        test('allowed user sees files and denied user sees redacted placeholder on channel load', async ({pw}) => {
            test.setTimeout(90000);
            test.skip(!licensed, 'No ABAC license');

            // Allowed user (Engineering) — should see real file attachments.
            const {channelsPage: allowedPage, page: allowedBrowser} = await pw.testBrowser.login(allowedUser as any);
            await allowedPage.goto(team.name, channelName);
            await allowedPage.toBeVisible();

            await expect(allowedBrowser.locator('[data-testid="fileAttachmentList"]').first()).toBeVisible({
                timeout: 30000,
            });
            await expect(allowedBrowser.getByTestId('redactedFilesPlaceholder')).toHaveCount(0);

            // Denied user (Sales) — should see the redacted placeholder instead.
            const {channelsPage: deniedPage, page: deniedBrowser} = await pw.testBrowser.login(deniedUser as any);
            await deniedPage.goto(team.name, channelName);
            await deniedPage.toBeVisible();

            await expect(deniedBrowser.getByTestId('redactedFilesPlaceholder').first()).toBeVisible({timeout: 30000});
            await expect(deniedBrowser.locator('[data-testid="fileAttachmentList"]')).toHaveCount(0);
        });

        // (C) After access is revoked and the page is reloaded, upload is blocked and
        // files are replaced by the redacted placeholder. Validates both the ETag
        // (fresh post-list response bypasses any cached data) and server sanitization
        // (SanitizePostListMetadataForUser strips file metadata for the denied user).
        test('upload is blocked and files are redacted after page reload when access is revoked', async ({pw}) => {
            test.setTimeout(90000);
            test.skip(!licensed, 'No ABAC license');

            const liveUser = await createUserForABAC(sharedAdminClient, attributeFieldsMap, [
                {name: 'Department', type: 'text', value: 'Engineering'},
            ]);
            await sharedAdminClient.addToTeam(team.id, liveUser.id);
            await sharedAdminClient.addToChannel(liveUser.id, channelId);

            const {channelsPage, page} = await pw.testBrowser.login(liveUser as any);
            await channelsPage.goto(team.name, channelName);
            await channelsPage.toBeVisible();

            // Engineering → allowed: upload enabled and files visible.
            await expect
                .poll(() => channelsPage.centerView.postCreate.attachmentButton.isEnabled(), {
                    timeout: 30000,
                    intervals: [500, 1500, 3000],
                })
                .toBe(true);
            await expect(page.locator('[data-testid="fileAttachmentList"]').first()).toBeVisible({timeout: 10000});

            // Revoke access via attribute change.
            await setupCustomProfileAttributeValuesForUser(
                sharedAdminClient,
                [{name: 'Department', type: 'text', value: 'Sales'}],
                attributeFieldsMap,
                liveUser.id,
            );

            // Reload forces a fresh fetch — the updated ETag (userCPAAt changed)
            // causes a cache miss and the server returns sanitized post metadata.
            await page.reload();
            await channelsPage.toBeVisible();

            await expect(channelsPage.centerView.postCreate.attachmentButton).toBeDisabled({timeout: 30000});
            await expect(page.getByTestId('redactedFilesPlaceholder').first()).toBeVisible({timeout: 30000});
            await expect(page.locator('[data-testid="fileAttachmentList"]')).toHaveCount(0);
        });
    },
);
