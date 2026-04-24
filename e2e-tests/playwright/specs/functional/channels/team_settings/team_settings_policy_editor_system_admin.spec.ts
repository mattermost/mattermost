// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for policy create/edit/delete in Team Settings Modal
 * @reference MM-67594
 */

import {ChannelsPage, expect, test} from '@mattermost/playwright-lib';

import {
    addAttributeRule,
    addChannelToPolicy,
    assignChannelsToPolicy,
    createParentPolicy,
    createPrivateChannel,
    createTeamAdmin,
    setUserAttribute,
    setupTeamWithABAC,
    unassignChannelsFromPolicy,
} from './support';

test.describe('Team Settings Modal - Policy Editor', () => {
    test('MM-67594_13 System Admin can also create policy from Team Settings', async ({pw}) => {
        const {adminUser, adminClient, team} = await setupTeamWithABAC(pw);

        // # Create private channel and set admin's Department attribute
        const channel = await createPrivateChannel(adminClient, team.id);
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        // # Navigate and wait for all API calls to settle (custom profile attributes
        // must be fetched before the self-inclusion check can validate the admin's Department)
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();
        await page.waitForLoadState('networkidle');

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // # Create policy
        await teamSettings.container.getByRole('button', {name: 'Add policy'}).click();

        const policyName = `SysAdmin Policy ${Date.now()}`;
        await teamSettings.container.locator('#input_policyName').fill(policyName);

        // # Add a rule row and fill in a value
        await addAttributeRule(teamSettings.container, page, 'Engineering');

        // # Add channel via channel selector
        await addChannelToPolicy(teamSettings.container, page, channel.display_name);

        // * Confirm the channel appears in the editor list before saving
        await expect(teamSettings.container.getByText(channel.display_name)).toBeVisible({timeout: 10000});

        // # Save via SaveChangesPanel — wait for button to be enabled (form fully dirty)
        const saveBtn = teamSettings.container.locator('[data-testid="SaveChangesPanel__save-btn"]');
        await expect(saveBtn).toBeEnabled({timeout: 10000});
        await saveBtn.click();

        // # Confirm in PolicyConfirmationModal
        await page.locator('.TeamPolicyConfirmationModal').waitFor({timeout: 30000});
        await page.getByRole('button', {name: /Apply policy/}).click();

        // * Auto-navigated back to list, policy appears
        await expect(teamSettings.container.getByText(policyName)).toBeVisible();

        await teamSettings.close();
    });

    test('MM-67594_2 System admin cross-team channel changes toggle team admin visibility', async ({pw}) => {
        // Scenario: System admin creates policy with team A channels → team admin A sees it →
        // system admin adds team B channel (cross-team) → team admin A no longer sees it →
        // system admin removes team B channel → team admin A sees it again.
        const {adminClient, team} = await setupTeamWithABAC(pw);

        // # Create a second team
        const otherTeam = await adminClient.createTeam({
            name: `other-${Date.now()}`,
            display_name: 'Other Team',
            type: 'O',
        } as any);

        // # Create team admin for team A with Department attribute
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Create private channels in both teams
        const channelA = await createPrivateChannel(adminClient, team.id);
        const channelB = await createPrivateChannel(adminClient, otherTeam.id);
        await adminClient.addToChannel(teamAdmin.id, channelA.id);

        // # System admin creates policy and assigns team A channel
        const policyName = `Cross-Team Scope Test ${Date.now()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        await assignChannelsToPolicy(adminClient, policy.id, [channelA.id]);

        // # Team admin logs in and opens team settings
        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        // # Step 1: Team admin can see the policy (all channels in their team)
        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        await expect(teamSettings.container.getByText(policyName)).toBeVisible({timeout: 10000});
        await teamSettings.close();

        // # Step 2: System admin adds a channel from team B (cross-team)
        await assignChannelsToPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should NOT be visible (cross-team)
        const teamSettings2 = await channelsPage.openTeamSettings();
        await teamSettings2.openAccessPoliciesTab();

        await expect(teamSettings2.container.getByText(policyName)).not.toBeVisible({timeout: 10000});
        await teamSettings2.close();

        // # Step 3: System admin removes team B channel (back to single-team)
        await unassignChannelsFromPolicy(adminClient, policy.id, [channelB.id]);

        // # Team admin reopens team settings — policy should be visible again
        const teamSettings3 = await channelsPage.openTeamSettings();
        await teamSettings3.openAccessPoliciesTab();

        await expect(teamSettings3.container.getByText(policyName)).toBeVisible({timeout: 10000});

        await teamSettings3.close();
    });
});
