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
    // Each test cleans up the policies, teams, and users it creates, even on
    // failure. initSetup's team/users are owned by the framework and left alone.
    let cleanupClient: Client4 | undefined;
    const createdPolicyIds: string[] = [];
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async () => {
        const client = cleanupClient;
        cleanupClient = undefined;
        const policyIds = createdPolicyIds.splice(0);
        const teamIds = createdTeamIds.splice(0);
        const userIds = createdUserIds.splice(0);
        if (!client) {
            return;
        }
        const base = client.getBaseRoute();
        const headers = {Authorization: `Bearer ${client.getToken()}`};
        for (const id of policyIds) {
            await fetch(`${base}/access_control_policies/${id}`, {method: 'DELETE', headers}).catch(() => {});
        }
        for (const id of teamIds) {
            await client.deleteTeam(id).catch(() => {});
        }
        for (const id of userIds) {
            await client.updateUserActive(id, false).catch(() => {});
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
        const policyFetchDone = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {}); // .catch: also handles 404 (no policy yet) and timeouts
        await openTeamConfig(page, team.display_name);
        await policyFetchDone; // ensure the fetch has settled before toggling on
        await setToggle(page, true);

        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked policy is listed before saving (scoped to the panel to avoid
        // matching the still-mounted modal's own .policy-name rows).
        const policyPanel = page.locator('#team_access_control_with_policy');
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 5000});

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
        // Set up the policy fetch waiter BEFORE navigating so we don't miss the
        // response that fires on componentDidMount — same pattern as the assign phase.
        const policyFetchDoneRemove = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneRemove;

        // Re-opened page hydrates the assigned policy from the server.
        await expect(
            page.locator('#team_access_control_with_policy').locator('.policy-name').filter({hasText: policyName}),
        ).toBeVisible({timeout: 15000});

        await page.getByLabel('Remove policy').click();

        // Removing now requires confirming the disconnect dialog before it is staged.
        const disconnectModal = page.locator('.ConfirmModal').filter({hasText: 'Remove this team from policy'});
        await expect(disconnectModal).toBeVisible({timeout: 5000});
        await disconnectModal.getByRole('button', {name: 'Remove policy'}).click();
        await expect(disconnectModal).not.toBeVisible({timeout: 5000});

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

        const policyFetchDoneT5 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT5;
        await setToggle(page, true);

        // Empty state + the link affordance are shown.
        await expect(page.getByText(/No membership policy assigned/i)).toBeVisible({timeout: 5000});
        await expect(page.locator('[data-testid="link-to-a-policy"]')).toBeVisible();

        // Saving with the toggle on but neither a linked policy nor a custom rule is rejected.
        await page.getByRole('button', {name: 'Save'}).click();
        await expect(page.getByText(/must select a membership policy or define custom access rules/i)).toBeVisible({
            timeout: 5000,
        });

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
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team with one matching (Engineering) and one non-matching (Marketing) member
        // # so the confirm modal shows a non-zero count instead of the empty-team warning
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const matchUser = await adminClient.createUser(
            {
                email: `match${suffix}@sample.mattermost.com`,
                username: `match${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(matchUser.id);
        await adminClient.addToTeam(team.id, matchUser.id);
        await setUserAttribute(adminClient, matchUser.id, 'Department', 'Engineering');

        const nonMatchUser = await adminClient.createUser(
            {
                email: `nomatch${suffix}@sample.mattermost.com`,
                username: `nomatch${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(nonMatchUser.id);
        await adminClient.addToTeam(team.id, nonMatchUser.id);
        await setUserAttribute(adminClient, nonMatchUser.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [matchUser.id]);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [
            nonMatchUser.id,
        ]);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT9 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
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
        await expect(confirmModal.getByText(/\d+ members? do(?:es)? not currently meet the criteria/i)).toBeVisible();

        // # Click Apply
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});

        // * Policy persisted with the Engineering rule
        const policy: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(JSON.stringify(policy)).toContain('Engineering');
    });

    /**
     * @objective Auto-add checkbox in the custom-rules panel is disabled until a rule
     * exists, and enabling it triggers a team sync job.
     */
    test('MM-68846-T10 - auto-add checkbox is disabled until a rule exists and enabling it triggers a sync job', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT10 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
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
    });

    /**
     * @objective When no current member matches the rule, the save-confirm modal surfaces
     * the empty-team warning text.
     */
    test('MM-68846-T11 - empty-team warning appears in the confirm modal when no member meets the criteria', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Private team; admin is NOT a member, only a Marketing user (doesn't match Engineering)
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const mktUser = await adminClient.createUser(
            {
                email: `mkt${suffix}@sample.mattermost.com`,
                username: `mkt${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(mktUser.id);
        await adminClient.addToTeam(team.id, mktUser.id);
        await setUserAttribute(adminClient, mktUser.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [mktUser.id]);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT11 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
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
    });

    /**
     * @objective Linking a PARENT policy (no custom team rules) computes the affected
     * count against the linked policy's expression, not the raw member total.
     *
     * Regression guard: the affected count is derived client-side from
     * searchUsersForExpression, whose endpoint does NOT resolve a policy's imports.
     * When only a parent policy is linked, the team's own expression is empty, so a
     * naive implementation falls back to "all members affected". The count must
     * instead evaluate the linked policy's expression — here one of two members
     * matches (Engineering), so exactly one is affected, never both.
     */
    test('MM-68846-T12 - linked policy affected count evaluates the policy expression, not the member total', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Parent policy that admits only Engineering
        const policyName = `Linked Count Policy ${suffix}`;
        const policy = await createTeamMembershipParentPolicy(
            adminClient,
            policyName,
            'user.attributes.Department == "Engineering"',
        );
        createdPolicyIds.push(policy.id);

        // # Private team whose only members are one match + one non-match. Remove the
        // # admin (auto-added on create) so the total is deterministically 2.
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        await adminClient.removeFromTeam(team.id, adminUser.id).catch(() => {});

        const matchUser = await adminClient.createUser(
            {
                email: `match${suffix}@sample.mattermost.com`,
                username: `match${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(matchUser.id);
        await adminClient.addToTeam(team.id, matchUser.id);
        await setUserAttribute(adminClient, matchUser.id, 'Department', 'Engineering');

        const nonMatchUser = await adminClient.createUser(
            {
                email: `nomatch${suffix}@sample.mattermost.com`,
                username: `nomatch${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(nonMatchUser.id);
        await adminClient.addToTeam(team.id, nonMatchUser.id);
        await setUserAttribute(adminClient, nonMatchUser.id, 'Department', 'Marketing');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [matchUser.id]);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [
            nonMatchUser.id,
        ]);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT12 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT12;

        // # Enable the toggle and link the parent policy (no custom rules added)
        await setToggle(page, true);
        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        const policyPanel = page.locator('#team_access_control_with_policy');
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 5000});

        // # Save to open the affected-count confirmation
        await page.getByRole('button', {name: 'Save'}).click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Apply membership policy'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * Exactly one member (the non-matching Marketing user) is affected — not both.
        await expect(confirmModal.getByText(/1 member does not currently meet the criteria/i)).toBeVisible();
        await expect(confirmModal.getByText(/2 members do not currently meet the criteria/i)).toHaveCount(0);

        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();
    });

    /**
     * @objective The per-row Remove action opens a disconnect confirmation with the
     * policy name and non-destructive-cancel behavior; only confirming stages removal.
     */
    test('MM-68846-T13 - disconnecting a policy requires confirming a named dialog', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Disconnect Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT13 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT13;

        const policyPanel = page.locator('#team_access_control_with_policy');
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 15000});

        // # Open the disconnect confirmation
        await page.getByLabel('Remove policy').click();
        const disconnectModal = page.locator('.ConfirmModal').filter({hasText: 'Remove this team from policy'});
        await expect(disconnectModal).toBeVisible({timeout: 5000});

        // * Dialog names the policy and explains members are retained
        await expect(disconnectModal.getByText(policyName)).toBeVisible();
        await expect(disconnectModal.getByText(/Existing members are retained/i)).toBeVisible();

        // # Cancel is non-destructive — the policy stays linked
        await disconnectModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(disconnectModal).not.toBeVisible();
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        // # Confirming removes it from the list (staged until save)
        await page.getByLabel('Remove policy').click();
        await expect(disconnectModal).toBeVisible({timeout: 5000});
        await disconnectModal.getByRole('button', {name: 'Remove policy'}).click();
        await expect(disconnectModal).not.toBeVisible({timeout: 5000});
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toHaveCount(0);
    });

    /**
     * @objective The custom-rules table editor supports the full row mechanics: picking a
     * multi-value operator, entering multiple values as chips, adding a second row, and
     * deleting rows down to the empty blank state.
     *
     * Exercises editor interactions the existing single-value helper doesn't cover.
     */
    test('MM-68846-T14 - custom rules editor handles operator, multi-value, and row deletion', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT14 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT14;

        await setToggle(page, true);
        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        const addAttribute = async () => {
            await rulesPanel.getByRole('button', {name: /Add attribute/}).click();
            const attrMenu = page.locator('[id^="attribute-selector-menu"]');
            await attrMenu.waitFor({state: 'visible', timeout: 5000});
            await attrMenu.locator('li').filter({hasText: 'Department'}).first().click();
        };

        // # Add the first rule row (Department, default operator)
        await addAttribute();
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(1);

        const row1 = rulesPanel.locator('.table-editor__row').first();

        // # Switch the operator to a multi-value operator ("in")
        await row1.locator('[data-testid="operatorSelectorMenuButton"]').click();
        await page.getByRole('menuitemradio', {name: 'in', exact: true}).click();

        // # Enter multiple values — each Enter creates a chip
        await row1.locator('[data-testid="valueSelectorMenuButton"]').click();
        const valueFilter = page.locator('#filter_values');
        await valueFilter.fill('Engineering');
        await valueFilter.press('Enter');
        await valueFilter.fill('Marketing');
        await valueFilter.press('Enter');

        // Close the value menu (click-away) so its overlay doesn't intercept later clicks.
        // Escape is swallowed by the filter input, so click a neutral spot instead.
        await page.mouse.click(5, 5);
        await expect(page.locator('#value-selector-menu')).toBeHidden({timeout: 5000});

        // * Two chips are present on the row
        await expect(row1.locator('.select__multi-value')).toHaveCount(2);
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Engineering'})).toBeVisible();
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Marketing'})).toBeVisible();

        // # Add a second rule row
        await addAttribute();
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(2);

        // # Delete the first row
        await rulesPanel.locator('.table-editor__row-remove').first().click();
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(1);

        // # Delete the remaining row — the editor returns to the blank state
        await rulesPanel.locator('.table-editor__row-remove').first().click();
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(0);
        await expect(rulesPanel.locator('.table-editor__blank-state')).toBeVisible();
    });

    /**
     * @objective Linking a parent policy from the per-team page enqueues a team sync
     * job on save even with auto-add OFF — membership changes must apply on save, not
     * wait for the hourly scheduler. On a strict team the reconcile removes
     * non-qualifying members; the job must be created regardless of auto-add.
     *
     * Regression guard for the auto-add-only trigger: the console previously kicked a
     * sync only when custom rules existed or auto-add was on, so a linked-parent-only
     * strict team deferred removals to the periodic scheduler.
     */
    test('MM-68846-T15 - linking a parent policy triggers a sync job on save with auto-add off', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // initSetup makes a strict team (type O, allow_open_invite false). Link a
        // parent policy that admits everyone so no member is actually removed — the
        // assertion is purely that a sync job is enqueued on save.
        const policyName = `Immediate Sync Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT15 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT15;

        const testStartTime = Date.now();

        // # Enable the toggle and link the parent policy — leave auto-add OFF.
        await setToggle(page, true);
        await page.locator('[data-testid="link-to-a-policy"]').click();
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await modal.waitFor({state: 'visible', timeout: 5000});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        const policyPanel = page.locator('#team_access_control_with_policy');
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({timeout: 5000});

        // # Save and confirm the apply dialog.
        await page.getByRole('button', {name: 'Save'}).click();
        const applyBtn = page.getByRole('button', {name: 'Apply'});
        await expect(applyBtn).toBeVisible({timeout: 5000});
        await applyBtn.click();
        await page.waitForLoadState('networkidle');

        // * A team sync job was enqueued for this team even though auto-add is off.
        await expect
            .poll(
                async () => {
                    const jobs: any[] = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                        {method: 'GET'},
                    );
                    return jobs.some((j: any) => j.data?.policy_id === team.id && j.create_at >= testStartTime);
                },
                {
                    timeout: 15000,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'linking a parent policy should enqueue a team sync job on save',
                },
            )
            .toBe(true);
    });

    /**
     * @objective Sync status footer appears inside the Custom access rules panel
     * when membership policy enforcement is enabled, showing "Never synced." and
     * a "Sync now" link for a team that has not yet been synced.
     */
    test('MM-68846-T16 - sync footer appears inside Custom access rules panel when enforcement is enabled', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT16 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT16;

        // # Enable membership policy enforcement so the Custom access rules panel renders
        await setToggle(page, true);

        // * Custom access rules panel is shown
        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        // * Sync footer is rendered inside the panel once the job-status fetch resolves
        const syncFooter = rulesPanel.locator('.SyncStatusFooter');
        await expect(syncFooter).toBeVisible({timeout: 10000});

        // * "Never synced." text is shown — no sync has run for this brand-new team
        await expect(syncFooter.locator('.SyncStatusFooter__text')).toContainText(/Never synced/i);

        // * "Sync now" link is present
        await expect(syncFooter.locator('.SyncStatusFooter__link')).toBeVisible();
    });

    /**
     * @objective Clicking "Sync now" in the Custom access rules panel of the
     * Team Details admin page enqueues an access_control_team_sync job scoped
     * to the team.
     */
    test('MM-68846-T17 - clicking "Sync now" in Team Details Custom access rules panel enqueues a team sync job', async ({
        pw,
    }) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyFetchDoneT17 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {timeout: 20000})
            .catch(() => {});
        await openTeamConfig(page, team.display_name);
        await policyFetchDoneT17;

        await setToggle(page, true);

        const rulesPanel = page.locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible({timeout: 10000});

        const syncFooter = rulesPanel.locator('.SyncStatusFooter');
        await expect(syncFooter).toBeVisible({timeout: 10000});
        await expect(syncFooter.locator('.SyncStatusFooter__link')).toBeVisible();

        const testStartTime = Date.now();

        // # Click "Sync now" inside the Custom access rules panel
        await syncFooter.locator('.SyncStatusFooter__link').click();

        // * A new team sync job scoped to this team is enqueued
        await expect
            .poll(
                async () => {
                    const jobs: any[] = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                        {method: 'GET'},
                    );
                    return jobs.some((j: any) => j.data?.policy_id === team.id && j.create_at >= testStartTime);
                },
                {
                    timeout: 15000,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'clicking Sync now in Team Details should enqueue a team sync job for this team',
                },
            )
            .toBe(true);
    });
});
