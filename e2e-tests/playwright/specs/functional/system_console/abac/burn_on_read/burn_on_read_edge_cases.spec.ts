// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * What happens to burn-on-read drafts and scheduled posts that outlive their author's
 * access, when a policy revokes the action after they were composed.
 *
 * Revoking rewrites nothing already stored: the draft keeps its type and the scheduled
 * post keeps its row. Left alone the user would be stranded, able to press Send on
 * something the server will refuse with 403
 * (api.post.create_post.burn_on_read.abac_denied.app_error) and with nothing in the client
 * to explain why. So the composer disables the send, the scheduled-post row withdraws the
 * actions that would be rejected, and the ways out — clearing the label, deleting the row
 * — stay available. These tests pin that, and pin that the stored records underneath are
 * left untouched.
 *
 * Whether a policy governs a user at all, and in which channels, is covered by
 * burn_on_read_policy_scope.spec.ts.
 */

import {expect, test, getRandomId, licenseTier} from '@mattermost/playwright-lib';

import {
    cleanupPolicy,
    ensureABACEnabled,
    requireFeatureFlag,
    getStoredScheduledPostType,
    grantBurnOnRead,
    revokeBurnOnRead,
    ensureBurnOnReadEnabled,
} from './helpers';

let policyName = '';
let grantPolicyName = '';
let savedAdminClient: any;

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(licenseTier(license.SkuShortName) < 30, 'Burn-on-read requires an Enterprise Advanced licence.');

    // Without this the allow-side assertions pass for the wrong reason: with the flag off
    // the client suppresses the decision request and defaults to allowed, so the control
    // is present regardless of policy.
    await requireFeatureFlag(pw, 'BurnOnReadABACPermission');
});

test.afterEach(async () => {
    if (savedAdminClient) {
        await cleanupPolicy(savedAdminClient, policyName);
        await cleanupPolicy(savedAdminClient, grantPolicyName);
        await ensureBurnOnReadEnabled(savedAdminClient);
    }
    policyName = '';
    grantPolicyName = '';
});

/**
 * @objective Verify a burn-on-read draft offers exactly one remove control.
 * UnifiedLabelsWrapper's remove-all is the one that belongs in the main composer; the
 * label's own X is gated on showIndividualCloseButton, which advanced_text_editor passes as
 * false. Revoking access must not introduce a second one.
 */
test('shows only the remove-all control on a burn-on-read draft label', {tag: '@abac_burn_on_read'}, async ({pw}) => {
    test.setTimeout(pw.duration.four_min);

    const {adminUser, adminClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureBurnOnReadEnabled(adminClient);
    await ensureABACEnabled(adminClient);

    // # Grant the action to this user, or the pre-existing policy denies it
    const {systemConsolePage: grantConsole} = await pw.testBrowser.login(adminUser);
    grantPolicyName = await grantBurnOnRead(grantConsole.page, adminClient, adminUser);
    await ensureABACEnabled(adminClient);

    // # Mark a draft as burn-on-read
    const {channelsPage} = await pw.testBrowser.login(adminUser);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.writeMessage(`draft ${getRandomId()}`);
    await channelsPage.centerView.postCreate.toggleBurnOnRead();
    await channelsPage.centerView.postCreate.toHaveBurnOnReadLabel();

    // * Verify one remove affordance, and that it is the remove-all
    await expect(channelsPage.centerView.postCreate.removeAllLabelsButton).toBeVisible();
    await expect(channelsPage.centerView.postCreate.burnOnReadLabelRemoveButton).toHaveCount(0);

    // # Revoke the action by policy
    const {systemConsolePage} = await pw.testBrowser.login(adminUser);
    policyName = await revokeBurnOnRead(systemConsolePage.page, adminClient);
    await ensureABACEnabled(adminClient);
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();

    // * Verify revocation does not add a second remove control
    await expect(channelsPage.centerView.postCreate.removeAllLabelsButton).toBeVisible();
    await expect(channelsPage.centerView.postCreate.burnOnReadLabelRemoveButton).toHaveCount(0);
});

/**
 * @objective Verify that revoking access by policy keeps an existing draft's burn-on-read
 * label but disables sending, and that clearing the label re-enables it.
 *
 * The type survives on the client, so submitting would reach the
 * server and be rejected with 403 api.post.create_post.burn_on_read.abac_denied.app_error —
 * previously surfaced as a bare Retry. The composer now blocks the send first
 * (isBurnOnReadSendable in use_burn_on_read.tsx), so that failure is unreachable and the
 * draft is not stranded: clearing the label is the way forward.
 */
test(
    'disables sending a burn-on-read draft when the policy revokes access',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const message = `bor revoked ${getRandomId()}`;

        // # Grant the action to this user, or the pre-existing policy denies it
        const {systemConsolePage: grantConsole} = await pw.testBrowser.login(adminUser);
        grantPolicyName = await grantBurnOnRead(grantConsole.page, adminClient, adminUser);
        await ensureABACEnabled(adminClient);

        // # Mark a draft as burn-on-read while still allowed
        const {channelsPage, draftsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.writeMessage(message);
        await channelsPage.centerView.postCreate.toggleBurnOnRead();
        await channelsPage.centerView.postCreate.toHaveBurnOnReadLabel();

        // # Revoke the action by policy
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        policyName = await revokeBurnOnRead(systemConsolePage.page, adminClient);
        await ensureABACEnabled(adminClient);
        await channelsPage.page.reload();
        await channelsPage.toBeVisible();

        // * Verify the control is gone, the label remains, and sending is blocked
        await channelsPage.centerView.postCreate.toHaveBurnOnReadHidden();
        await channelsPage.centerView.postCreate.toHaveBurnOnReadLabel();
        await expect(channelsPage.centerView.postCreate.sendMessageButton).toBeDisabled();

        // # The Drafts list is a second way to send the same draft, so check it too
        await draftsPage.goto(team.name);
        await draftsPage.toBeVisible();
        const draft = await draftsPage.getLastPost();
        await draft.hover();

        // * Verify Send and Schedule are withdrawn there as well. Schedule goes with
        // Send because creating a scheduled post is enforced the same way, so offering
        // it would only move the rejection later.
        await expect(draft.sendButton).toHaveCount(0);
        await expect(draft.scheduleButton).toHaveCount(0);

        // * Verify the ways out of the state are still offered — Edit returns to the
        // composer, where the label can be cleared, and Delete discards the draft
        await expect(draft.editButton).toBeVisible();
        await expect(draft.deleteButton).toBeVisible();

        // # Back to the composer, and clear the burn-on-read label
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.removeAllLabelsButton.click();

        // * Verify sending is offered again once the draft is no longer burn-on-read
        await channelsPage.centerView.postCreate.toHaveNoBurnOnReadLabel();
        await expect(channelsPage.centerView.postCreate.sendMessageButton).toBeEnabled();

        // # Send the draft
        await channelsPage.centerView.postCreate.sendMessage();

        // * Verify it posted as an ordinary message, with no burn-on-read markers
        await pw.waitUntil(
            async () => {
                const post = await channelsPage.getLastPost();
                return (await post.container.textContent())?.includes(message);
            },
            {timeout: pw.duration.one_min},
        );
        const posted = await channelsPage.getLastPost();
        await expect(posted.container.getByTestId(/^burn-on-read-badge-/)).toHaveCount(0);
        await expect(posted.container.getByTestId(/^burn-on-read-concealed-/)).toHaveCount(0);
    },
);

/**
 * @objective Verify that revoking access by policy withdraws Edit, Reschedule and Send now
 * from a scheduled burn-on-read post, leaving Delete and Copy text.
 *
 * The server rejection is by design: updateScheduledPost is a listed enforcement surface,
 * and api4 restores the stored type before the checks run, so the policy check sees a
 * burn-on-read post and returns 403 — covered directly by
 * TestBurnOnReadABACEnforcementDenies/updateScheduledPost. The client used to accept the
 * edit and discard it with no indication the save failed; it now declines to offer the
 * three controls that end that way. Delete stays because it is the only way out of the
 * state, and Copy text cannot fail.
 */
test(
    'withdraws edit, reschedule and send now from a scheduled burn-on-read post after the policy revokes access',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const original = `bor scheduled ${getRandomId()}`;

        // # Grant the action to this user, or the pre-existing policy denies it
        const {systemConsolePage: grantConsole} = await pw.testBrowser.login(adminUser);
        grantPolicyName = await grantBurnOnRead(grantConsole.page, adminClient, adminUser);
        await ensureABACEnabled(adminClient);

        // # Schedule a burn-on-read post two days out so it cannot fire mid-test
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.toggleBurnOnRead();
        await channelsPage.scheduleMessage(original, 2, 0);

        // # Revoke the action by policy
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        policyName = await revokeBurnOnRead(systemConsolePage.page, adminClient);
        await ensureABACEnabled(adminClient);

        // # Open the scheduled posts list and reveal the row's actions
        await scheduledPostsPage.goto(team.name);
        await scheduledPostsPage.toBeVisible();
        const scheduled = await scheduledPostsPage.getLastPost();
        await scheduled.hover();

        // * Verify the three actions that would be rejected are not offered. Absence from
        // the DOM, not invisibility: a disabled-but-present control would be a different
        // design and should fail here.
        await expect(scheduled.editButton).toHaveCount(0);
        await expect(scheduled.rescheduleButton).toHaveCount(0);
        await expect(scheduled.sendNowButton).toHaveCount(0);

        // * Verify the two that always work are still offered
        await expect(scheduled.deleteButton).toBeVisible();
        await expect(scheduled.copyTextButton).toBeVisible();

        // * Verify the scheduled post itself is untouched
        await expect(scheduledPostsPage.page.getByText(original)).toBeVisible();
    },
);

/**
 * @objective Verify that a burn-on-read post scheduled while allowed keeps its queued record
 * intact after the policy is revoked, and that Send Now is no longer offered for it.
 *
 * The asymmetry the spec calls for still exists underneath — Send Now never evaluates the
 * policy, so the API would accept it — but the client stops offering an action whose result
 * would contradict the policy the admin just set. The stored type assertion is the point of
 * keeping this separate from the edit-path test: withdrawing the control must not touch
 * the record.
 */
test(
    'withdraws Send Now from a queued burn-on-read post after the policy revokes access',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminUser, adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const message = `queued bor ${getRandomId()}`;

        // # Grant the action to this user, or the pre-existing policy denies it
        const {systemConsolePage: grantConsole} = await pw.testBrowser.login(adminUser);
        grantPolicyName = await grantBurnOnRead(grantConsole.page, adminClient, adminUser);
        await ensureABACEnabled(adminClient);

        // # Schedule a burn-on-read post two days out so it cannot fire mid-test
        const {channelsPage, scheduledPostsPage} = await pw.testBrowser.login(adminUser);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.toggleBurnOnRead();
        await channelsPage.scheduleMessage(message, 2, 0);

        // # Revoke the action while the post sits queued
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        policyName = await revokeBurnOnRead(systemConsolePage.page, adminClient);
        await ensureABACEnabled(adminClient);

        // # Open the scheduled posts list and reveal the row's actions
        await scheduledPostsPage.goto(team.name);
        await scheduledPostsPage.toBeVisible();
        const scheduled = await scheduledPostsPage.getLastPost();
        await scheduled.hover();

        // * Verify Send Now is no longer offered for the queued post
        await expect(scheduled.sendNowButton).toHaveCount(0);

        // * Verify the post is still queued, and still stored as burn-on-read — the client
        // withdrew a control, it did not rewrite the record
        await expect(scheduledPostsPage.page.getByText(message)).toBeVisible();
        expect(await getStoredScheduledPostType(adminClient, team.id, message)).toBe('burn_on_read');
    },
);
