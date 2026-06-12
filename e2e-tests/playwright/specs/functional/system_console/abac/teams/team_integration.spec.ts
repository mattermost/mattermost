// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Locator, Page} from '@playwright/test';

import {expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    addAttributeRule,
    createPrivateTeam,
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    getTeamAccessControlPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

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
        // Set up before the navigation so the componentDidMount-fired
        // fetchAccessControlPolicies response is captured. For a fresh team the
        // server returns {policy: null, enforced: false}, which calls
        // setState({policyEnforced: false}). If that response arrives AFTER
        // setToggle it resets policyEnforced to false, hiding 'Link to a policy'.
        const policyFetchDone = page.waitForResponse(
            (resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`),
            {timeout: 20000},
        ).catch(() => {}); // .catch: also handles 404 (no policy yet) and timeouts
        await openTeamConfig(page, team.display_name);
        await policyFetchDone; // ensure the fetch has settled before toggling on
        await setToggle(page, true);

        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked policy is listed before saving.
        await expect(page.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 5000});

        await page.getByRole('button', {name: 'Save'}).click();

        // Assigning a new policy triggers a confirmation dialog ("Apply membership policy").
        // Confirm it so handleSubmit actually runs and the assignment is persisted.
        const applyBtn = page.getByRole('button', {name: 'Apply'});
        await expect(applyBtn).toBeVisible({timeout: 5000});
        await applyBtn.click();

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

        const policyFetchDoneT5 = page.waitForResponse(
            (resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`),
            {timeout: 20000},
        ).catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT5;
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

    /**
     * @objective Custom-rules editor in the per-team page persists the rule and shows
     * the affected-count confirmation modal before applying.
     */
    test('MM-68846-T9 - custom access rules save shows the affected-count confirmation and persists', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team with one non-matching member so the count in the modal is non-zero
        const team = await createPrivateTeam(adminClient, suffix);
        const nonMatchUser = await adminClient.createUser(
            {
                email: `nomatch${suffix}@sample.mattermost.com`,
                username: `nomatch${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, nonMatchUser.id);
        await setUserAttribute(adminClient, nonMatchUser.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Marketing"',
            [nonMatchUser.id],
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT9 = page.waitForResponse(
            (resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`),
            {timeout: 20000},
        ).catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT9;

        // # Enable the enforce toggle
        await setToggle(page, true);

        // * Custom-rules panel appears
        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        // # Add Engineering rule against the panel container
        await addAttributeRule(rulesPanel, page, 'Engineering');

        // # Save via page-level SaveChangesPanel
        await page.getByRole('button', {name: 'Save'}).click();

        // * Save-confirm modal appears with the affected-count text
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15000});
        await expect(confirmModal.getByText(/\d+ members? do not currently meet the criteria/i)).toBeVisible();

        // # Click Apply
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});

        // * Policy persisted with the Engineering rule
        const policy: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(JSON.stringify(policy)).toContain('Engineering');

        await adminClient.deleteTeam(team.id);
    });

    /**
     * @objective Auto-add checkbox in the custom-rules panel is disabled until a rule
     * exists, and enabling it triggers a team sync job.
     */
    test('MM-68846-T10 - auto-add checkbox is disabled until a rule exists and enabling it triggers a sync job', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const team = await createPrivateTeam(adminClient, suffix);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT10 = page.waitForResponse(
            (resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`),
            {timeout: 20000},
        ).catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT10;

        // # Enable enforce toggle
        await setToggle(page, true);

        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        const autoAddCheckbox = page.locator('[data-testid="team-auto-add-members-checkbox"]');

        // * Auto-add is disabled while editor is empty
        await expect(autoAddCheckbox).toBeDisabled({timeout: 5000});

        // # Add a rule — checkbox should enable
        await addAttributeRule(rulesPanel, page, 'Engineering');
        await expect(autoAddCheckbox).toBeEnabled({timeout: 5000});

        // # Enable auto-add and record time before save
        await autoAddCheckbox.click();
        await expect(autoAddCheckbox).toBeChecked();
        const testStartTime = Date.now();

        // # Save
        await page.getByRole('button', {name: 'Save'}).click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15000});
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});

        // * A sync job was created (auto-add ON)
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBeGreaterThan(0);

        await adminClient.deleteTeam(team.id);
    });

    /**
     * @objective When no current member matches the rule, the save-confirm modal surfaces
     * the empty-team warning text.
     */
    test('MM-68846-T11 - empty-team warning appears in the confirm modal when no member meets the criteria', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team; admin is NOT a member, only a Marketing user (doesn't match Engineering)
        const team = await createPrivateTeam(adminClient, suffix);
        const mktUser = await adminClient.createUser(
            {
                email: `mkt${suffix}@sample.mattermost.com`,
                username: `mkt${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        await adminClient.addToTeam(team.id, mktUser.id);
        await setUserAttribute(adminClient, mktUser.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Marketing"',
            [mktUser.id],
        );

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT11 = page.waitForResponse(
            (resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`),
            {timeout: 20000},
        ).catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT11;

        // # Enable enforce toggle
        await setToggle(page, true);

        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        // # Add Engineering rule — no current member matches
        await addAttributeRule(rulesPanel, page, 'Engineering');

        await page.getByRole('button', {name: 'Save'}).click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * Empty-team warning present
        await expect(confirmModal.getByText(/No current members meet the criteria/i)).toBeVisible({timeout: 10000});

        // # Cancel
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();

        await adminClient.deleteTeam(team.id);
    });
});
