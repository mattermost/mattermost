// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Locator, Page} from '@playwright/test';

import {expect, test} from '@mattermost/playwright-lib';

import {assignTeamsToPolicy, createTeamMembershipParentPolicy, enableTeamMembershipPolicies} from './helpers';

/**
 * ABAC — Team Membership (per-team System Console page)
 *
 * Covers the System Console > User Management > Teams > [Team] "Team Management"
 * surface added for team membership policies: the attribute-based access toggle,
 * linking/removing a parent policy, the group-sync mutual-exclusivity affordance,
 * the empty state, and the policy-list "Applies to" team count.
 *
 * Enforcement and sync (removal/auto-add) are exercised by the join/sync specs;
 * these tests assert the console management UI and the resulting server state
 * (team.policy_enforced) only.
 */
test.describe('ABAC - Team Membership console', {tag: ['@abac', '@team_membership']}, () => {
    // Each test cleans up the policies it creates, even on failure. initSetup's
    // team/users are owned by the framework and left alone.
    let cleanupClient: Client4 | undefined;
    const createdPolicyIds: string[] = [];

    test.afterEach(async () => {
        const client = cleanupClient;
        cleanupClient = undefined;
        const policyIds = createdPolicyIds.splice(0);
        if (!client) {
            return;
        }
        const base = client.getBaseRoute();
        const headers = {Authorization: `Bearer ${client.getToken()}`};
        for (const id of policyIds) {
            await fetch(`${base}/access_control_policies/${id}`, {method: 'DELETE', headers}).catch(() => {});
        }
    });

    /**
     * Navigate to a team's configuration page from the Teams list and wait for it to load.
     */
    async function openTeamConfig(page: Page, teamDisplayName: string): Promise<void> {
        await page.goto('/admin_console/user_management/teams');
        await page.waitForLoadState('networkidle');

        const search = page.locator('input[placeholder*="Search" i]').first();
        await search.fill(teamDisplayName);
        await page.waitForTimeout(1000);

        const row = page.locator('.DataGrid_row').filter({hasText: teamDisplayName}).first();
        await row.waitFor({state: 'visible', timeout: 10000});
        await row.getByText('Edit').click();
        await page.waitForLoadState('networkidle');
    }

    /**
     * Search a policy DataGrid (modal or full page) and return the matching row.
     *
     * The PolicyList fires an unfiltered fetch on mount; we wait for that to land
     * before typing so our search isn't overwritten by the late-resolving initial
     * load (which would otherwise show the first page of unrelated policies).
     */
    async function findPolicyRow(scope: Page | Locator, policyName: string): Promise<Locator> {
        await scope
            .locator('.DataGrid_row')
            .first()
            .waitFor({state: 'visible', timeout: 15000})
            .catch(() => {
                // Empty list is fine — the search below will populate it.
            });
        await scope.locator('[data-testid="searchInput"]').fill(policyName);
        const row = scope.locator('.DataGrid_row').filter({hasText: policyName}).first();
        await expect(row).toBeVisible({timeout: 15000});
        return row;
    }

    async function setToggle(page: Page, on: boolean): Promise<void> {
        const toggle = page.locator('[data-testid="policy-enforce-toggle-button"]');
        await toggle.waitFor({state: 'visible', timeout: 10000});
        const pressed = (await toggle.getAttribute('aria-pressed')) === 'true';
        if (pressed !== on) {
            await toggle.click();
        }
    }

    /**
     * Assign a membership policy to a team from the per-team page, verify the team
     * becomes policy-enforced, then remove it and verify enforcement is cleared.
     *
     * @objective The toggle + "Link to a policy" flow persists an assignment, and the
     * trash + disable-toggle flow unassigns it — both reflected in team.policy_enforced.
     */
    test('MM-68846-T3 - assigns and removes a membership policy from the per-team page', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Team Console Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        // --- Assign ---------------------------------------------------------
        await openTeamConfig(page, team.display_name);
        await setToggle(page, true);

        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked policy is listed before saving.
        await expect(page.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 5000});

        await page.getByRole('button', {name: 'Save'}).click();
        await page.waitForLoadState('networkidle');

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: 15000,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should become policy-enforced after assigning a policy',
            })
            .toBe(true);

        // --- Remove ---------------------------------------------------------
        await openTeamConfig(page, team.display_name);

        // Re-opened page hydrates the assigned policy from the server.
        await expect(page.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 15000});

        await page.getByLabel('Remove policy').click();

        // Once the last policy is removed the toggle unlocks; disable it before saving.
        await setToggle(page, false);
        await page.getByRole('button', {name: 'Save'}).click();
        await page.waitForLoadState('networkidle');

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: 15000,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should no longer be policy-enforced after removing the policy',
            })
            .toBe(false);
    });

    /**
     * @objective A group-synced team cannot use a membership policy: the ABAC toggle is
     * disabled with an explanatory notice, and becomes usable once group sync is off.
     */
    test('MM-68846-T4 - disables the membership-policy toggle with a notice for group-synced teams', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // Mock group sync without LDAP by constraining the team directly.
        await adminClient.patchTeam({id: team.id, group_constrained: true} as any);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        await openTeamConfig(page, team.display_name);

        const toggle = page.locator('[data-testid="policy-enforce-toggle-button"]');
        await toggle.waitFor({state: 'visible', timeout: 10000});
        await expect(toggle).toBeDisabled();
        await expect(page.getByText(/Group synced teams cannot use a membership policy/i)).toBeVisible();

        // Turning group sync off unlocks the toggle.
        await adminClient.patchTeam({id: team.id, group_constrained: false} as any);
        await page.reload();
        await page.waitForLoadState('networkidle');

        const toggleAfter = page.locator('[data-testid="policy-enforce-toggle-button"]');
        await toggleAfter.waitFor({state: 'visible', timeout: 10000});
        await expect(toggleAfter).toBeEnabled();
    });

    /**
     * @objective Enabling attribute-based access without linking a policy shows the empty
     * state and blocks save with a clear error — the team is never left enforced-but-empty.
     */
    test('MM-68846-T5 - shows the empty state and blocks save when no policy is linked', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        await openTeamConfig(page, team.display_name);
        await setToggle(page, true);

        // Empty state + the link affordance are shown.
        await expect(page.getByText(/No membership policy assigned/i)).toBeVisible({timeout: 5000});
        await expect(page.locator('[data-testid="link-to-a-policy"]')).toBeVisible();

        // Saving with the toggle on but no policy is rejected.
        await page.getByRole('button', {name: 'Save'}).click();
        await expect(page.getByText(/must select a membership policy/i)).toBeVisible({timeout: 5000});

        // The server state is untouched — no policy was assigned.
        expect((await adminClient.getTeam(team.id)).policy_enforced).toBeFalsy();
    });

    /**
     * @objective The Membership Policies list "Applies to" column reflects assigned teams,
     * proving the channel/team count split (props.team_count) renders.
     */
    test('MM-68846-T6 - policy list shows the team count after assignment', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Team Count Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;

        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');

        // Filter to our policy so the assertion is stable under parallel runs.
        const policyRow = await findPolicyRow(page, policyName);
        await expect(policyRow).toContainText('1 team');
    });
});
