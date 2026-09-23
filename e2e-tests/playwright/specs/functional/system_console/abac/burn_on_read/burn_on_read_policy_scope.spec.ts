// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Which subjects a burn-on-read policy governs, and in which channels.
 *
 * burn_on_read_edge_cases.spec.ts covers what happens to drafts and scheduled posts that
 * outlive their author's access, using one user who is granted the action and then denied
 * it. These cover the other axis: attribute matching between two users, system scope
 * reaching DMs and GMs, and a channel policy staying inside its own channel.
 *
 * All three assert on whether the composer offers the burn-on-read control. The server
 * rejection behind it is covered deterministically in Go by
 * TestBurnOnReadABACEnforcementDenies at all three entry points; reproving it through a
 * browser adds nothing, and since the composer withholds the control there is no longer a
 * UI path that produces a 403 anyway.
 */

import {expect, test, getRandomId, licenseTier} from '@mattermost/playwright-lib';

import {createPrivateChannelForABAC, createUserForABAC} from '../support';

import {
    DENY_ALL_CEL,
    grantToEmailCEL,
    deletePolicyById,
    ensureABACEnabled,
    requireFeatureFlag,
    ensureBurnOnReadEnabled,
    upsertChannelPolicy,
    upsertSystemPolicy,
} from './helpers';

let systemPolicyId = '';
let channelPolicyId = '';
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
    await requireFeatureFlag(pw, 'PermissionPolicies');
});

test.afterEach(async () => {
    if (savedAdminClient) {
        await deletePolicyById(savedAdminClient, systemPolicyId);
        await deletePolicyById(savedAdminClient, channelPolicyId);
        await ensureBurnOnReadEnabled(savedAdminClient);
    }
    systemPolicyId = '';
    channelPolicyId = '';
});

/**
 * @objective Verify one attribute-matching policy offers burn-on-read to the user who
 * matches it and withholds it from the user who does not, in the same channel.
 *
 * Every other spec in this directory grants the action and then denies it with a
 * deny-everyone expression, so attribute matching itself is never exercised, and nothing
 * proves an allowed user is unaffected while a policy is active. Both users sit in
 * town-square under the same policy, so the only thing that differs is the attribute.
 *
 * Deliberately ONE policy plus a user who fails to match, not a grant policy plus a deny
 * policy: rules for the same role are AND'd (ResolvePermissionRule), so a deny would win
 * over the grant and both users would lose the action.
 */
test(
    'offers burn-on-read to the user matching the policy and withholds it from the user who does not',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        // # Two users. No custom profile attributes: the policy keys on the native
        // user.email field, so nothing has to be provisioned for it to compile.
        const allowedUser = await createUserForABAC(adminClient, {}, []);
        const deniedUser = await createUserForABAC(adminClient, {}, []);

        // # createUserForABAC does not join a team, and the composer is only reachable
        // from inside one
        await adminClient.addToTeam(team.id, allowedUser.id);
        await adminClient.addToTeam(team.id, deniedUser.id);

        // # Govern the action with a single policy matching one of the two users
        systemPolicyId = await upsertSystemPolicy(adminClient, {
            name: `BoR Match ${getRandomId()}`,
            expression: grantToEmailCEL(allowedUser.email),
        });
        await ensureABACEnabled(adminClient);

        // # View town-square as the user the policy matches
        const {channelsPage: allowedPage} = await pw.testBrowser.login(allowedUser);
        await allowedPage.goto(team.name, 'town-square');
        await allowedPage.toBeVisible();

        // * Verify the control is offered
        await allowedPage.centerView.postCreate.toHaveBurnOnReadVisible();

        // # Send a burn-on-read message
        const message = `bor allowed ${getRandomId()}`;
        await allowedPage.centerView.postCreate.toggleBurnOnRead();
        await allowedPage.postMessage(message);

        // * Verify it posted as burn-on-read rather than being silently downgraded
        const posted = await allowedPage.getLastPost();
        await expect(posted.body).toContainText(message);
        await expect(posted.burnOnReadBadge.container).toBeVisible();

        // # View the same channel as the user the policy does not match
        const {channelsPage: deniedPage} = await pw.testBrowser.login(deniedUser);
        await deniedPage.goto(team.name, 'town-square');
        await deniedPage.toBeVisible();

        // * Verify the control is withheld, so no burn-on-read post can be composed
        await deniedPage.centerView.postCreate.toHaveBurnOnReadHidden();
    },
);

/**
 * @objective Verify a system-scoped policy governs burn-on-read inside DMs and GMs, not only
 * inside team channels.
 *
 * System scope is the only scope that reaches DMs and GMs — a channel policy cannot attach
 * to either, since ValidateChannelEligibilityForAccessControl rejects both — and DMs are
 * burn-on-read's primary surface. If this breaks, the feature is ungoverned exactly where
 * it is used most.
 *
 * The grant half runs first and in the same test: without it, a hidden control proves
 * nothing, because it is equally what a DM that never renders the control at all would
 * look like.
 */
test('governs burn-on-read in DMs and GMs under a system-scoped policy', {tag: '@abac_burn_on_read'}, async ({pw}) => {
    test.setTimeout(pw.duration.four_min);

    const {adminClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureBurnOnReadEnabled(adminClient);
    await ensureABACEnabled(adminClient);

    const sender = await createUserForABAC(adminClient, {}, []);
    const other1 = await createUserForABAC(adminClient, {}, []);
    const other2 = await createUserForABAC(adminClient, {}, []);
    for (const user of [sender, other1, other2]) {
        await adminClient.addToTeam(team.id, user.id);
    }

    // # Open a DM and a GM the sender belongs to
    await adminClient.createDirectChannel([sender.id, other1.id]);
    const gm = await adminClient.createGroupChannel([sender.id, other1.id, other2.id]);

    // # Grant the action, so the "denied" state later is a change and not the default
    systemPolicyId = await upsertSystemPolicy(adminClient, {
        name: `BoR DM GM ${getRandomId()}`,
        expression: grantToEmailCEL(sender.email),
    });
    await ensureABACEnabled(adminClient);

    const {channelsPage} = await pw.testBrowser.login(sender);

    // * Verify the control is offered in the DM and in the GM while granted
    await channelsPage.goto(team.name, `@${other1.username}`);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.toHaveBurnOnReadVisible();

    await channelsPage.goto(team.name, gm.name);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.toHaveBurnOnReadVisible();

    // # Tighten the SAME policy to deny everyone. Replacing it in place rather than
    // adding a second policy keeps the AND-ing of same-role rules out of the picture.
    await upsertSystemPolicy(adminClient, {
        id: systemPolicyId,
        name: `BoR DM GM ${getRandomId()}`,
        expression: DENY_ALL_CEL,
    });
    await ensureABACEnabled(adminClient);

    // * Verify the control is withdrawn in both
    await channelsPage.goto(team.name, `@${other1.username}`);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.toHaveBurnOnReadHidden();

    await channelsPage.goto(team.name, gm.name);
    await channelsPage.toBeVisible();
    await channelsPage.centerView.postCreate.toHaveBurnOnReadHidden();
});

/**
 * @objective Verify a channel-scoped policy governs burn-on-read in its own channel and
 * leaves every other channel alone.
 *
 * The system grant is what makes the contrast readable: the action has to be governed and
 * allowed in both channels first, so the only difference between them is the channel
 * policy. The two rules then AND together in channel A and deny.
 *
 * The existing channel-policy spec, channel_settings/channel_perm_rules_v0_4.spec.ts,
 * covers the authoring UI only — tab visibility, editor sections, inline validation — and
 * never creates a working policy, so there is nothing to reuse here.
 */
test(
    'withholds burn-on-read only in the channel its policy is pinned to',
    {tag: '@abac_burn_on_read'},
    async ({pw}) => {
        test.setTimeout(pw.duration.four_min);

        const {adminClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureBurnOnReadEnabled(adminClient);
        await ensureABACEnabled(adminClient);

        const user = await createUserForABAC(adminClient, {}, []);
        await adminClient.addToTeam(team.id, user.id);

        // # Two private channels. Private because a channel policy cannot attach to a
        // default, DM, GM, group-constrained or shared channel.
        const governed = await createPrivateChannelForABAC(adminClient, team.id);
        const ungoverned = await createPrivateChannelForABAC(adminClient, team.id);
        await adminClient.addToChannel(user.id, governed.id);
        await adminClient.addToChannel(user.id, ungoverned.id);

        // # Allow the action system-wide, so both channels start from "granted"
        systemPolicyId = await upsertSystemPolicy(adminClient, {
            name: `BoR Channel Scope ${getRandomId()}`,
            expression: grantToEmailCEL(user.email),
        });
        await ensureABACEnabled(adminClient);

        // # Deny it in one channel only
        channelPolicyId = await upsertChannelPolicy(adminClient, {
            channelId: governed.id,
            expression: DENY_ALL_CEL,
        });
        await ensureABACEnabled(adminClient);

        const {channelsPage} = await pw.testBrowser.login(user);

        // * Verify the control is withheld in the channel the policy is pinned to
        await channelsPage.goto(team.name, governed.name);
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.toHaveBurnOnReadHidden();

        // * Verify the policy did not reach the channel it was not pinned to
        await channelsPage.goto(team.name, ungoverned.name);
        await channelsPage.toBeVisible();
        await channelsPage.centerView.postCreate.toHaveBurnOnReadVisible();
    },
);
