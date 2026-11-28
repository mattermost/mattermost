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

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {
    expect,
    test,
    getRandomId,
    licenseTier,
    openChannel,
    type App,
    type PlaywrightExtended,
    DefaultChannel,
    Api,
    settle,
} from '@mattermost/playwright-lib';

import {lastPost} from '../../../channels/burn_on_read/support';
import {scheduleMessage} from '../../../channels/scheduled_messages/support';

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
let savedAdminClient: Client4 | undefined;

test.beforeEach(async ({pw}) => {
    await pw.ensureLicense();
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(licenseTier(license.SkuShortName) < 30, 'Burn-on-read requires an Enterprise Advanced licence.');

    // Without this the allow-side assertions pass for the wrong reason: with the flag off
    // the client suppresses the decision request and defaults to allowed, so the control
    // is present regardless of policy.
    await requireFeatureFlag(pw, 'PermissionPolicies');
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
 * Grants the admin burn-on-read (or the pre-existing policy denies it), returning a System Console session to revoke
 * it from later and the admin's town-square. The two are separate sessions so the revoke doesn't navigate away from
 * the composer under test.
 */
async function grantAndOpenTownSquare(
    pw: PlaywrightExtended,
    adminUser: UserProfile,
    adminClient: Client4,
    team: Team,
) {
    const {app: console} = await pw.testBrowser.login(adminUser);
    grantPolicyName = await grantBurnOnRead(console, adminClient, adminUser);
    await ensureABACEnabled(adminClient);
    const app = await openChannel(pw, adminUser, {team, channel: DefaultChannel.TownSquare});
    return {console, app};
}

/** Revokes burn-on-read by policy and reloads the user's page so it picks up the decision. */
async function revokeAndReload(console: App, app: App, adminClient: Client4) {
    policyName = await revokeBurnOnRead(console, adminClient);
    await ensureABACEnabled(adminClient);
    await app.page.reload();
    await expect(app.center.postCreate.message.container).toBeVisible();
}

/** Schedules a burn-on-read post two days out, so it cannot fire mid-test. */
async function scheduleBurnOnRead(app: App, message: string) {
    const composer = app.center.postCreate;
    await composer.burnOnReadButton.click();
    await expect(composer.burnOnReadLabel).toBeVisible();
    await scheduleMessage(app, composer, message, 2, 0);
}

/** The scheduled post with this text on the scheduled posts page, hovered so its actions show. */
async function scheduledPostWith(app: App, team: Team, message: string) {
    await app.scheduledPostsPage.goto({team});
    const {scheduled} = app.drafts;
    const post = await scheduled.postList.itemWith({text: message});
    await post.container.hover();
    // Delete is always offered, so it shows the actions are revealed (Send now may be withdrawn).
    await expect(post.deleteButton).toBeVisible();
    return post;
}

// Asserts that no individual remove button appears inside the burn-on-read label.
async function expectNoIndividualRemove(composer: App['center']['postCreate']) {
    // The individual control is absent from this mount's API; assert that no button appears inside the label.
    // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the absence of any button role is the subject; the label's individual remove control is not rendered, so it has no testid
    await expect(composer.burnOnReadLabel.locator.getByRole('button')).toHaveCount(0);
}

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

    // # Grant the action to this user, then mark a draft as burn-on-read
    const {console, app} = await grantAndOpenTownSquare(pw, adminUser, adminClient, team);
    const composer = app.center.postCreate;
    await composer.message.container.fill(`draft ${getRandomId()}`);
    await composer.burnOnReadButton.click();
    await expect(composer.burnOnReadLabel).toBeVisible();

    // * Verify the remove-all control is offered
    await expect(composer.removeAllLabelsButton).toBeVisible();
    await expectNoIndividualRemove(composer);

    // # Revoke the action by policy
    await revokeAndReload(console, app, adminClient);

    // * Verify the label and its remove-all control remain
    await expect(composer.burnOnReadLabel).toBeVisible();
    await expect(composer.removeAllLabelsButton).toBeVisible();
    await expectNoIndividualRemove(composer);
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

        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const message = `bor revoked ${getRandomId()}`;

        // # Grant the action to this user, then mark a draft as burn-on-read while still allowed
        const {console, app} = await grantAndOpenTownSquare(pw, adminUser, adminClient, team);
        const composer = app.center.postCreate;
        await composer.message.container.fill(message);
        await composer.burnOnReadButton.click();
        await expect(composer.burnOnReadLabel).toBeVisible();
        await expect(composer.sendButton).toBeEnabled();

        // # Revoke the action by policy
        await revokeAndReload(console, app, adminClient);

        // * Verify the control is gone (not rendered at all), the label remains, and sending is blocked
        await expect(composer.burnOnReadButton).not.toBeAttached();
        await expect(composer.burnOnReadLabel).toBeVisible();
        await expect(composer.sendButton).toBeDisabled();

        // # The Drafts list is a second way to send the same draft, so check it too
        await app.draftsPage.goto({team});
        const list = app.drafts.saved;
        const draft = await list.draftList.itemWith({text: message});
        await expect(draft.message).toContainText(message);
        await draft.container.hover();

        // * Verify the ways out of the state are still offered — Edit returns to the
        // composer, where the label can be cleared, and Delete discards the draft
        await expect(draft.editButton).toBeVisible();
        await expect(draft.deleteButton).toBeVisible();

        // * Verify Send and Schedule are withdrawn there as well. Schedule goes with
        // Send because creating a scheduled post is enforced the same way, so offering
        // it would only move the rejection later.
        await expect(draft.sendButton).toHaveCount(0);
        await expect(draft.rescheduleButton).toHaveCount(0);

        // # Back to the composer, and clear the burn-on-read label
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(composer.burnOnReadLabel).toBeVisible();
        await composer.removeAllLabelsButton.click();

        // * Verify sending is offered again once the draft is no longer burn-on-read
        await expect(composer.burnOnReadLabel).not.toBeVisible();
        await expect(composer.sendButton).toBeEnabled();

        // # Send the draft
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();

        // * Verify it posted as an ordinary message, with no burn-on-read markers
        // The post-body container has no text-reading driver; include the burn-on-read wrapper's content.
        await expect.poll(async () => (await lastPost(app)).post.body.locator.textContent()).toContain(message);
        const {post} = await lastPost(app);
        await expect(post.burnOnReadButton).toHaveCount(0);
        await expect(post.revealButton).toHaveCount(0);
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

        // # Grant the action to this user, then schedule a burn-on-read post
        const {console, app} = await grantAndOpenTownSquare(pw, adminUser, adminClient, team);
        await scheduleBurnOnRead(app, original);

        // # Revoke the action by policy
        await revokeAndReload(console, app, adminClient);

        // # Open the scheduled posts list and reveal the row's actions
        const scheduled = await scheduledPostWith(app, team, original);

        // * Verify the scheduled post itself is untouched
        await expect(scheduled.message).toContainText(original);

        // * Verify the two that always work are still offered
        await expect(scheduled.deleteButton).toBeVisible();
        await expect(scheduled.copyTextButton).toBeVisible();

        // * Verify the three actions that would be rejected are not offered. Absence from
        // the DOM, not invisibility: a disabled-but-present control would be a different
        // design and should fail here.
        await expect(scheduled.editButton).toHaveCount(0);
        await expect(scheduled.rescheduleButton).toHaveCount(0);
        await expect(scheduled.sendNowButton).toHaveCount(0);
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

        // # Grant the action to this user, then schedule a burn-on-read post
        const {console, app} = await grantAndOpenTownSquare(pw, adminUser, adminClient, team);
        await scheduleBurnOnRead(app, message);

        // # Revoke the action while the post sits queued
        await revokeAndReload(console, app, adminClient);

        // # Open the scheduled posts list and reveal the row's actions
        const scheduled = await scheduledPostWith(app, team, message);

        // * Verify the post is still queued, and still stored as burn-on-read — the client
        // withdrew a control, it did not rewrite the record
        await expect(scheduled.message).toContainText(message);
        expect(await getStoredScheduledPostType(adminClient, team.id, message)).toBe('burn_on_read');

        // * Verify Delete is still offered, and Send Now no longer is
        await expect(scheduled.deleteButton).toBeVisible();
        await expect(scheduled.sendNowButton).toHaveCount(0);
    },
);
