// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {expect, test} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createPublicChannel,
    createTeamAdmin,
    loginAndOpenPoliciesTab,
    setUserAttribute,
    setupTeamWithABAC,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_11b Add channels modal excludes channels already assigned to the policy', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        // # Create two channels and assign one to the policy via API
        const assignedChannel = await createPrivateChannel(adminClient, team.id);
        const unassignedChannel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Duplicate Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [assignedChannel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, assignedChannel.id);
        await adminClient.addToChannel(teamAdmin.id, unassignedChannel.id);

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open the existing policy editor
        await teamSettings.container.getByText(policy.name).click();
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible({timeout: 10000});

        // # Open Add channels modal
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();
        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});

        // * Already assigned channel is NOT shown in the modal
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: assignedChannel.display_name}),
        ).not.toBeVisible();

        // * Unassigned channel IS shown in the modal
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: unassignedChannel.display_name}),
        ).toBeVisible();

        await page.keyboard.press('Escape');
        await teamSettings.close();
    });

    test('MM-67594_12 Success message shown after saving policy', async ({pw}) => {
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const channel = await createPrivateChannel(adminClient, team.id);
        const policy = await createParentPolicy(adminClient, `Toast Test ${Date.now()}`);
        await assignChannelsToPolicy(adminClient, policy.id, [channel.id]);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Edit policy name (name-only change — no confirmation modal)
        await teamSettings.container.getByText(policy.name).click();

        await teamSettings.container.locator('#input_policyName').clear();
        await teamSettings.container.locator('#input_policyName').fill(`Updated ${Date.now()}`);

        // # Save
        await teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Success message visible on list view
        await expect(teamSettings.container.locator('.SaveChangesPanel.saved')).toBeVisible();
        await expect(teamSettings.container.getByText('Policy updated')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_14 Add channels modal shows only private member channels even when team has >50 public channels', async ({
        pw,
    }) => {
        // Regression: the non-sysConsole fast path previously called AutocompleteChannelsForTeam
        // which ignored the private=true filter and returned a mixed set capped at 50.
        // With >50 public channels, private channels were cut off before client-side filtering.
        const {adminClient, team} = await setupTeamWithABAC(pw);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Create 55 public channels — more than the 50-result autocomplete cap
        for (let i = 0; i < 55; i++) {
            const pub = await createPublicChannel(adminClient, team.id);
            await adminClient.addToChannel(teamAdmin.id, pub.id);
        }

        // # Create 2 private channels the team admin is a member of
        const privateChannel1 = await createPrivateChannel(adminClient, team.id);
        const privateChannel2 = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, privateChannel1.id);
        await adminClient.addToChannel(teamAdmin.id, privateChannel2.id);

        // # Create a private channel, add the team admin, then make it group-constrained.
        // Membership must be established before the constraint is set — the API rejects
        // addToChannel on an already-constrained channel.
        const gcChannel = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, gcChannel.id);
        await adminClient.patchChannel(gcChannel.id, {group_constrained: true} as any);

        const {page, teamSettings} = await loginAndOpenPoliciesTab(pw, teamAdmin, team.name);

        // # Open the policy editor and click Add channels
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();
        await expect(teamSettings.container.locator('#input_policyName')).toBeVisible({timeout: 10000});
        await teamSettings.container.getByRole('button', {name: /Add channels/}).click();

        const channelModal = page.locator('.channel-selector-modal');
        await channelModal.waitFor();
        await expect(channelModal.locator('.more-modal__row').first()).toBeVisible({timeout: 10000});

        // * Both private channels appear despite 55 public channels exceeding the cap
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: privateChannel1.display_name}),
        ).toBeVisible();
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: privateChannel2.display_name}),
        ).toBeVisible();

        // * No public channels appear in the modal
        const rows = channelModal.locator('.more-modal__row');
        const count = await rows.count();
        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            const icon = row.locator('.icon-globe');
            await expect(icon).not.toBeVisible();
        }

        // * Group-constrained channel does not appear
        await expect(
            channelModal.locator('.more-modal__row').filter({hasText: gcChannel.display_name}),
        ).not.toBeVisible();

        await page.keyboard.press('Escape');
        await teamSettings.close();
    });
});
