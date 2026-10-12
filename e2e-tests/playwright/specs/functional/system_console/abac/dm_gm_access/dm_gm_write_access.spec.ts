// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Write Direct and Group Messages (dm_gm_write_access): a denied session can still read its
 * DMs and GMs but not post in them or change their content, while channels stay writable.
 *
 * Each test denies one user only (denyOnly).
 */

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    DM_GM_WRITE_ACCESS,
    POLICY_PROPAGATION_TIMEOUT,
    createConversations,
    deletePolicyById,
    denyOnly,
    ensureABACEnabled,
    prepareDmGmTest,
    upsertDmGmPolicy,
} from './helpers';

const WRITE_DENIED_PLACEHOLDER = 'You do not have permission to send direct or group messages.';

let policyId = '';
let savedAdminClient: any;

test.afterEach(async () => {
    if (savedAdminClient) {
        await deletePolicyById(savedAdminClient, policyId);
    }
    policyId = '';
});

/**
 * @objective Verify a Write denial disables the DM and GM composers with the policy's
 * placeholder while town-square stays writable.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test(
    'disables the DM and GM composers while Write is denied and leaves channels writable',
    {tag: '@abac_dm_gm'},
    async ({pw}) => {
        await prepareDmGmTest(pw);
        test.setTimeout(pw.duration.four_min);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureABACEnabled(adminClient);

        const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmwrite');
        const {gm} = await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

        // # Deny Write to this user only
        policyId = await upsertDmGmPolicy(adminClient, {
            name: `DM/GM Write ${getRandomId()}`,
            actions: [DM_GM_WRITE_ACCESS],
            expression: denyOnly(user.email),
        });
        await ensureABACEnabled(adminClient);

        const {channelsPage} = await pw.testBrowser.login(user);
        const input = channelsPage.centerView.postCreate.input;

        // # Open the DM
        await channelsPage.goto(team.name, `@${partner.username}`);
        await channelsPage.toBeVisible();

        // * Verify its composer is disabled and says why
        await expect(input).toHaveAttribute('placeholder', WRITE_DENIED_PLACEHOLDER, {
            timeout: POLICY_PROPAGATION_TIMEOUT,
        });
        await expect(input).toBeDisabled();

        // # Open the GM
        await channelsPage.gotoMessage(team.name, gm.name);
        await channelsPage.toBeVisible();

        // * Verify its composer is disabled the same way
        await expect(input).toHaveAttribute('placeholder', WRITE_DENIED_PLACEHOLDER);
        await expect(input).toBeDisabled();

        // # Post in town-square
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();
        const message = `still writable ${getRandomId()}`;
        await channelsPage.postMessage(message);

        // * Verify the channel still accepts the post
        const lastPost = await channelsPage.getLastPost();
        await expect(lastPost.body).toContainText(message);
    },
);

/**
 * @objective Verify a user denied Write is offered no Edit, Reply or Forward on a DM post.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test('offers no Edit, Reply or Forward on DM posts while Write is denied', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw);
    test.setTimeout(pw.duration.four_min);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);

    const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmmenu');
    const {dm} = await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

    // # Post in the DM as the user, while Write is still allowed
    const message = `own dm post ${getRandomId()}`;
    await userClient.createPost({channel_id: dm.id, message} as any);

    // # Deny Write to this user only
    policyId = await upsertDmGmPolicy(adminClient, {
        name: `DM/GM Write ${getRandomId()}`,
        actions: [DM_GM_WRITE_ACCESS],
        expression: denyOnly(user.email),
    });
    await ensureABACEnabled(adminClient);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, `@${partner.username}`);
    await channelsPage.toBeVisible();
    await expect(channelsPage.centerView.postCreate.input).toBeDisabled({timeout: POLICY_PROPAGATION_TIMEOUT});

    // # Hover the user's own post
    const post = await channelsPage.getLastPost();
    await expect(post.body).toContainText(message);
    await post.hover();
    await post.postMenu.toBeVisible();

    // * Verify there is no reply button
    await expect(post.postMenu.replyButton).not.toBeVisible();

    // # Open its dot menu
    await post.postMenu.dotMenuButton.click();
    await channelsPage.postDotMenu.toBeVisible();

    // * Verify Edit, Reply and Forward are missing while other items remain
    await expect(channelsPage.postDotMenu.copyLinkMenuItem).toBeVisible();
    await expect(channelsPage.postDotMenu.editMenuItem).not.toBeVisible();
    await expect(channelsPage.postDotMenu.replyMenuItem).not.toBeVisible();
    await expect(channelsPage.postDotMenu.forwardMenuItem).not.toBeVisible();
});

/**
 * @objective Verify a draft typed in a DM survives a Write denial and is back in the composer
 * once the policy is relaxed.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test('keeps a typed DM draft through a Write denial', {tag: '@abac_dm_gm'}, async ({pw}) => {
    await prepareDmGmTest(pw);
    test.setTimeout(pw.duration.four_min);

    const {adminClient, user, userClient, team} = await pw.initSetup();
    savedAdminClient = adminClient;
    await ensureABACEnabled(adminClient);

    const [partner, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 3, 'dmgmdraft');
    await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

    const {channelsPage} = await pw.testBrowser.login(user);
    const input = channelsPage.centerView.postCreate.input;

    // # Type a draft in the DM without sending it, then leave
    await channelsPage.goto(team.name, `@${partner.username}`);
    await channelsPage.toBeVisible();
    const draft = `unsent draft ${getRandomId()}`;
    await channelsPage.centerView.postCreate.writeMessage(draft);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Deny Write to this user only
    policyId = await upsertDmGmPolicy(adminClient, {
        name: `DM/GM Write ${getRandomId()}`,
        actions: [DM_GM_WRITE_ACCESS],
        expression: denyOnly(user.email),
    });
    await ensureABACEnabled(adminClient);

    // # Go back to the DM
    await channelsPage.goto(team.name, `@${partner.username}`);
    await channelsPage.toBeVisible();

    // * Verify the composer is disabled while denied
    await expect(input).toBeDisabled({timeout: POLICY_PROPAGATION_TIMEOUT});

    // # Relax the policy
    await deletePolicyById(adminClient, policyId);
    policyId = '';

    // * Verify the composer comes back with the draft in it
    await expect(input).toBeEnabled({timeout: POLICY_PROPAGATION_TIMEOUT});
    await expect(input).toHaveValue(draft);
});
