// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Read Direct and Group Messages (dm_gm_read_access): a denied session stops seeing every
 * DM and GM, and they come back intact, unread counts included, when access returns.
 *
 * Each test denies one user only (denyOnly), so the admin's own setup keeps working. A Read
 * denial is system-wide for that user, so assertions are about that user's conversations
 * and a channel stays available to land on.
 */

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    DM_GM_READ_ACCESS,
    POLICY_PROPAGATION_TIMEOUT,
    createConversations,
    deletePolicyById,
    denyOnly,
    ensureABACEnabled,
    prepareDmGmTest,
    upsertDmGmPolicy,
} from './helpers';

let policyId = '';
let savedAdminClient: any;

test.afterEach(async () => {
    if (savedAdminClient) {
        await deletePolicyById(savedAdminClient, policyId);
    }
    policyId = '';
});

/**
 * @objective Verify a Read denial hides the Direct Messages category and every DM and GM while
 * channels stay, and that relaxing the policy restores them with a mention made meanwhile.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test(
    'hides DMs and GMs while Read is denied and restores them with their mentions once allowed',
    {tag: '@abac_dm_gm'},
    async ({pw}) => {
        await prepareDmGmTest(pw);
        test.setTimeout(pw.duration.four_min);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureABACEnabled(adminClient);

        // # Give the user a DM and a GM
        const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmread');
        const {dm, gm} = await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const sidebar = channelsPage.sidebarLeft;
        const dmCategory = sidebar.container.getByRole('button', {name: 'Direct Messages', exact: true});

        // * Verify the category and both conversations show before the policy
        await expect(dmCategory).toBeVisible();
        await expect(sidebar.item(dm.name)).toBeVisible();
        await expect(sidebar.item(gm.name)).toBeVisible();

        // # Deny Read to this user only
        policyId = await upsertDmGmPolicy(adminClient, {
            name: `DM/GM Read ${getRandomId()}`,
            actions: [DM_GM_READ_ACCESS],
            expression: denyOnly(user.email),
        });
        await ensureABACEnabled(adminClient);

        // * Verify the category and the conversations disappear, and town-square stays
        await expect(dmCategory).not.toBeVisible({timeout: POLICY_PROPAGATION_TIMEOUT});
        await expect(sidebar.item(dm.name)).not.toBeVisible();
        await expect(sidebar.item(gm.name)).not.toBeVisible();
        await expect(sidebar.item('town-square')).toBeVisible();

        // # Mention the user in the DM while it is hidden
        const {client: partnerClient} = await pw.makeClient(partner);
        await partnerClient.createPost({
            channel_id: dm.id,
            message: `@${user.username} while hidden ${getRandomId()}`,
        } as any);

        // # Relax the policy
        await deletePolicyById(adminClient, policyId);
        policyId = '';

        // * Verify the conversations come back, the DM carrying the mention badge
        await expect(dmCategory).toBeVisible({timeout: POLICY_PROPAGATION_TIMEOUT});
        await expect(sidebar.item(gm.name)).toBeVisible();
        await expect(sidebar.item(dm.name).locator('.badge')).toHaveText('1', {timeout: POLICY_PROPAGATION_TIMEOUT});
    },
);

/**
 * @objective Verify a user looking at a DM when Read is denied is told why and lands on
 * town-square.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test(
    'shows the access-denied modal and redirects when Read is denied while viewing a DM',
    {tag: '@abac_dm_gm'},
    async ({pw}) => {
        await prepareDmGmTest(pw);
        test.setTimeout(pw.duration.four_min);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureABACEnabled(adminClient);

        const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmview');
        await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

        // # Open the DM
        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, `@${partner.username}`);
        await channelsPage.toBeVisible();

        // # Deny Read to this user only
        policyId = await upsertDmGmPolicy(adminClient, {
            name: `DM/GM Read ${getRandomId()}`,
            actions: [DM_GM_READ_ACCESS],
            expression: denyOnly(user.email),
        });
        await ensureABACEnabled(adminClient);

        // * Verify the modal explains that direct and group messages are gone. It renders with
        // role="none", so it is found by its title id rather than as a dialog.
        await expect(page.locator('#channelAccessDeniedModalLabel')).toHaveText('No longer available', {
            timeout: POLICY_PROPAGATION_TIMEOUT,
        });
        await expect(
            page.getByText(
                'You no longer have access to direct and group messages. They will reappear if access is restored.',
            ),
        ).toBeVisible();

        // # Dismiss it
        await page.locator('#channelAccessDeniedBtn').click();

        // * Verify the user lands on town-square
        await channelsPage.expectOnTeamChannel(team.name, 'town-square');
    },
);

/**
 * @objective Verify a user denied Read before logging in sees no Direct Messages category, and
 * that a DM link falls back to a channel instead of opening the conversation.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test('shows no conversations to a user denied Read before logging in', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw);
    test.setTimeout(pw.duration.four_min);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);

    const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmlogin');
    await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

    // # Deny Read to this user only, before they log in
    policyId = await upsertDmGmPolicy(adminClient, {
        name: `DM/GM Read ${getRandomId()}`,
        actions: [DM_GM_READ_ACCESS],
        expression: denyOnly(user.email),
    });
    await ensureABACEnabled(adminClient);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // * Verify there is no Direct Messages category, while the channels are there
    await expect(channelsPage.sidebarLeft.item('town-square')).toBeVisible();
    await expect(
        channelsPage.sidebarLeft.container.getByRole('button', {name: 'Direct Messages', exact: true}),
    ).not.toBeVisible();

    // # Follow a link to the DM
    await channelsPage.goto(team.name, `@${partner.username}`);

    // * Verify the user falls back to town-square rather than the conversation
    await channelsPage.expectOnTeamChannel(team.name, 'town-square');
});
