// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Start Direct and Group Messages (dm_gm_start): a denied session is offered no way to
 * start a new conversation, while existing ones keep working.
 *
 * The test first proves the affordances work, so the absences asserted after the denial
 * aren't vacuous. It denies one user only (denyOnly).
 */

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {
    DM_GM_START,
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
 * @objective Verify a Start denial removes every way to start a conversation (the +, the
 * shortcut, the menus, the switcher and DM links) while an existing DM stays reachable.
 *
 * @precondition
 * PermissionPolicies feature flag on, an Enterprise Advanced licence, and attribute-based
 * access control enabled.
 */
test(
    'offers no way to start a conversation while Start is denied, and keeps existing ones',
    {tag: '@abac_dm_gm'},
    async ({pw}) => {
        await prepareDmGmTest(pw);
        test.setTimeout(pw.duration.four_min);

        const {adminClient, user, userClient, team} = await pw.initSetup();
        savedAdminClient = adminClient;
        await ensureABACEnabled(adminClient);

        // # A partner the user already has a DM with, and a stranger they have never messaged
        const [partner, stranger, gmMember1, gmMember2] = await adminClient.createUsers(team.id, 4, 'dmgmstart');
        await createConversations(userClient, user, partner, [gmMember1, gmMember2]);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const sidebar = channelsPage.sidebarLeft;
        const directChannelsModal = channelsPage.directChannelsModal;

        // # Before the policy: open the direct messages modal with the shortcut, then the +
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ControlOrMeta+Shift+K');

        // * Verify the shortcut opens it
        await directChannelsModal.toBeVisible();
        await page.keyboard.press('Escape');
        await expect(directChannelsModal.container).not.toBeVisible();

        await sidebar.openDirectMessageButton.click();

        // * Verify the + opens it
        await directChannelsModal.toBeVisible();
        await page.keyboard.press('Escape');
        await expect(directChannelsModal.container).not.toBeVisible();

        // # Deny Start to this user only, and reload so the decision is fetched on load
        policyId = await upsertDmGmPolicy(adminClient, {
            name: `DM/GM Start ${getRandomId()}`,
            actions: [DM_GM_START],
            expression: denyOnly(user.email),
        });
        await ensureABACEnabled(adminClient);
        await page.reload();
        await channelsPage.toBeVisible();

        // * Verify the + is gone and the shortcut does nothing
        await expect(sidebar.openDirectMessageButton).not.toBeVisible();
        await channelsPage.centerView.postCreate.input.focus();
        await page.keyboard.press('ControlOrMeta+Shift+K');
        await expect(directChannelsModal.container).not.toBeVisible();

        // # Open the browse-or-create menu
        await sidebar.browseOrCreateChannelButton.click();

        // * Verify it lacks "Open a direct message" while still offering to browse channels
        await expect(page.getByRole('menuitem', {name: /Browse channels/})).toBeVisible();
        await expect(page.getByRole('menuitem', {name: /Open a direct message/})).not.toBeVisible();
        await page.keyboard.press('Escape');

        // # Open the Direct Messages category menu, whose button shows on hover
        await sidebar.container.getByRole('button', {name: 'Direct Messages', exact: true}).hover();
        await sidebar.container.getByRole('button', {name: 'Direct Messages category options'}).click();

        // * Verify it lacks "Open a direct message" too
        await expect(page.getByRole('menuitem', {name: /Sort/}).first()).toBeVisible();
        await expect(page.getByRole('menuitem', {name: /Open a direct message/})).not.toBeVisible();
        await page.keyboard.press('Escape');

        // # Mention both people in town-square and open the stranger's profile popover
        await channelsPage.postMessage(`@${stranger.username} @${partner.username}`);
        const lastPost = await channelsPage.getLastPost();
        await lastPost.container.getByText(`@${stranger.username}`, {exact: true}).click();
        const popover = channelsPage.userProfilePopover;
        await popover.toBeVisible();

        // * Verify messaging the stranger is disabled and explained
        await expect(
            popover.container.getByRole('button', {
                name: `Cannot message ${stranger.username}. You can't start new direct messages.`,
            }),
        ).toBeDisabled();
        await popover.close();

        // # Open the partner's profile popover
        await lastPost.container.getByText(`@${partner.username}`, {exact: true}).click();
        await popover.toBeVisible();

        // * Verify messaging the partner, who already has a DM, is still enabled
        await expect(
            popover.container.getByRole('button', {name: `Send message to ${partner.username}`}),
        ).toBeEnabled();
        await popover.close();

        // # Search for both people in the channel switcher
        await page.keyboard.press('ControlOrMeta+K');
        const switcher = channelsPage.findChannelsModal;
        await switcher.toBeVisible();
        await switcher.input.fill(partner.username);

        // * Verify the partner is found, so the search itself works
        await expect(switcher.container.getByText(partner.username).first()).toBeVisible();

        await switcher.input.fill(stranger.username);
        await page.waitForLoadState('networkidle');

        // * Verify the stranger is not offered
        await expect(switcher.container.getByText(stranger.username)).toHaveCount(0);
        await page.keyboard.press('Escape');

        // # Follow a link to a DM with the stranger
        await channelsPage.goto(team.name, `@${stranger.username}`);

        // * Verify it falls back to town-square instead of creating the DM
        await channelsPage.expectOnTeamChannel(team.name, 'town-square');
    },
);
