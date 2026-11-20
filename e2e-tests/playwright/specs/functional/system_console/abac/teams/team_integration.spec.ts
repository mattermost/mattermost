// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {
    Api,
    duration,
    expect,
    newTestPassword,
    systemConsolePath,
    test,
    waitForApi,
    type App,
} from '@mattermost/playwright-lib';

import {
    addAttributeRule,
    createPrivateTeam,
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    getTeamAccessControlPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

import {
    assignTeamsToPolicy,
    createTeamMembershipParentPolicy,
    enableTeamMembershipPolicies,
    findPolicyRow,
    openTeamConfig,
    setToggle,
} from './helpers';

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
/** The team form's rules have no declared ancestor; locate its body by the declared name field. */
function teamContent(app: App) {
    // The content wrapper has no test id; the generated team-name field identifies this form.
    return app.page.locator('.admin-console__content').filter({has: app.admin.team.name.container.locator});
}

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
     * Assign a membership policy to a team from the per-team page, verify the team
     * becomes policy-enforced, then remove it and verify enforcement is cleared.
     *
     * @objective The toggle + "Link to a policy" flow persists an assignment, and the
     * trash + disable-toggle flow unassigns it — both reflected in team.policy_enforced.
     */
    test('MM-68846-T3 - assigns and removes a membership policy from the per-team page', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Team Console Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;

        // --- Assign ---------------------------------------------------------
        // Set up before the navigation so the componentDidMount-fired
        // fetchAccessControlPolicies response is captured. For a fresh team the
        // server returns {policy: null, enforced: false}, which calls
        // setState({policyEnforced: false}). If that response arrives AFTER
        // setToggle it resets policyEnforced to false, hiding 'Link to a policy'.
        const policyFetchDone = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {}); // .catch: also handles 404 (no policy yet) and timeouts
        await openTeamConfig(app, team.display_name);
        await policyFetchDone; // ensure the fetch has settled before toggling on
        await setToggle(app, true);

        // The policy-link control has no generated part; its DOM id is bounded by this team form.
        await teamContent(app).locator('[data-testid="link-to-a-policy"]').click();
        // The membership chooser is portalled and has no generated scope; its dialog title identifies it.
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await expect(modal).toBeVisible({timeout: duration.ten_sec});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked policy is listed before saving (scoped to the panel to avoid
        // matching the still-mounted modal's own .policy-name rows).
        // The linked-policy panel has no generated scope; its DOM id is bounded by the identified team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        await app.admin.team.savePanel.saveButton.click();

        // Assigning a new policy triggers a confirmation dialog ("Apply membership policy").
        // Confirm it so handleSubmit actually runs and the assignment is persisted.
        const applyBtn = app.admin.team.saveConfirmModal.confirmButton;
        await expect(applyBtn).toBeVisible();
        await Promise.all([waitForApi(page, Api.PatchTeam, {params: {team_id: team.id}}), applyBtn.click()]);

        await page.waitForLoadState('networkidle');

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should become policy-enforced after assigning a policy',
            })
            .toBe(true);

        // --- Remove ---------------------------------------------------------
        // Set up the policy fetch waiter BEFORE navigating so we don't miss the
        // response that fires on componentDidMount — same pattern as the assign phase.
        const policyFetchDoneRemove = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneRemove;

        // Re-opened page hydrates the assigned policy from the server.
        await expect(
            teamContent(app)
                // The linked-policy panel and name have no generated parts; inspect them within this team form.
                .locator('#team_access_control_with_policy')
                // The linked-policy panel and name have no generated parts; inspect them within this team form.
                .locator('.policy-name')
                .filter({hasText: policyName}),
        ).toBeVisible({timeout: duration.half_min});

        await teamContent(app).getByLabel('Remove policy').click();

        // Removing now requires confirming the disconnect dialog before it is staged.
        // The removal confirmation has no generated scope; its title identifies the portalled dialog.
        const disconnectModal = page.locator('.ConfirmModal').filter({hasText: 'Remove this team from policy'});
        await expect(disconnectModal).toBeVisible();
        await disconnectModal.getByRole('button', {name: 'Remove policy'}).click();
        await expect(disconnectModal).not.toBeVisible();

        // Removing the last policy auto-disables enforcement: Save goes straight through
        // with no "Apply membership policy" modal and no manual toggle-off.
        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.saveConfirmModal.locator).toHaveCount(0);
        await page.waitForLoadState('networkidle');

        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should no longer be policy-enforced after removing the policy',
            })
            .toBe(false);
    });

    /**
     * @objective Removing a linked policy from a team that also has a custom rule saves
     * cleanly: enforcement stays on (the rule still governs) and no affected-count "Apply
     * membership policy" modal appears. Removal is not new criteria — regression for the
     * modal firing on an unedited, pre-existing custom rule.
     *
     * The webapp unit test mocks the rules editor, so it can't exercise the real
     * hasChanges signal that caused the bug; this drives the real editor end to end.
     */
    test('MM-68846-T20 - removing a policy while a custom rule remains saves without the apply modal', async ({pw}) => {
        test.setTimeout(duration.two_min);
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

        const policyName = `Eng Policy ${suffix}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;

        // # Link the policy and add a custom rule, then persist both in one save
        const policyFetchDone = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDone;
        await setToggle(app, true);

        // The policy-link control has no generated part; its DOM id is bounded by this team form.
        await teamContent(app).locator('[data-testid="link-to-a-policy"]').click();
        // The membership chooser is portalled and has no generated scope; its dialog title identifies it.
        const linkModal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await expect(linkModal).toBeVisible({timeout: duration.ten_sec});
        const policyRow = await findPolicyRow(linkModal, policyName);
        await policyRow.click();

        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();
        await addAttributeRule(rulesPanel, page, 'Engineering');

        await app.admin.team.savePanel.saveButton.click();
        const applyModal = app.admin.team.saveConfirmModal.locator;
        await expect(applyModal).toBeVisible({timeout: duration.half_min});
        await applyModal.getByRole('button', {name: 'Apply'}).click();
        await expect(applyModal).not.toBeVisible();
        await page.waitForLoadState('networkidle');

        // # Re-open and remove the policy; the custom rule stays
        const policyFetchDoneRemove = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneRemove;

        await expect(
            teamContent(app)
                // The linked-policy panel and name have no generated parts; inspect them within this team form.
                .locator('#team_access_control_with_policy')
                // The linked-policy panel and name have no generated parts; inspect them within this team form.
                .locator('.policy-name')
                .filter({hasText: policyName}),
        ).toBeVisible({timeout: duration.half_min});

        await teamContent(app).getByLabel('Remove policy').click();
        // The removal confirmation has no generated scope; its title identifies the portalled dialog.
        const disconnectModal = page.locator('.ConfirmModal').filter({hasText: 'Remove this team from policy'});
        await expect(disconnectModal).toBeVisible();
        await disconnectModal.getByRole('button', {name: 'Remove policy'}).click();
        await expect(disconnectModal).not.toBeVisible();

        // * Custom rule still governs, so enforcement stays on
        await expect(app.admin.team.policyEnforce.container).toBeChecked();

        // * Save goes straight through: removal is not new criteria, so no apply modal
        await app.admin.team.savePanel.saveButton.click();
        await expect(app.admin.team.saveConfirmModal.locator).toHaveCount(0);
        await page.waitForLoadState('networkidle');

        // * Team stays policy-enforced: the custom rule survives the policy removal
        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should remain policy-enforced: a custom rule still governs after policy removal',
            })
            .toBe(true);
    });

    /**
     * @objective A group-synced team cannot use a membership policy: the ABAC toggle is
     * disabled with an explanatory notice, and becomes usable once group sync is off.
     */
    test('MM-68846-T4 - disables the membership-policy toggle with a notice for group-synced teams', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // Mock group sync without LDAP by constraining the team directly.
        await adminClient.patchTeam({id: team.id, group_constrained: true} as any);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;

        await openTeamConfig(app, team.display_name);

        const toggle = app.admin.team.policyEnforce.container;
        await expect(toggle).toBeVisible({timeout: duration.ten_sec});
        await expect(toggle).toBeDisabled();
        await expect(teamContent(app).getByText(/Group synced teams cannot use a membership policy/i)).toBeVisible();

        // Turning group sync off unlocks the toggle.
        await adminClient.patchTeam({id: team.id, group_constrained: false} as any);
        await page.reload();
        await page.waitForLoadState('networkidle');

        const toggleAfter = app.admin.team.policyEnforce.container;
        await expect(toggleAfter).toBeVisible({timeout: duration.ten_sec});
        await expect(toggleAfter).toBeEnabled();
    });

    /**
     * @objective Enabling attribute-based access shows the empty state and the link
     * affordance. Saving with nothing defined (no linked policy, no custom rule) turns
     * ABAC back off cleanly rather than erroring — the team is never left enforced-but-empty.
     */
    test('MM-68846-T5 - enabling the toggle with nothing defined saves cleanly and leaves ABAC off', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;

        const policyFetchDoneT5 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT5;
        await setToggle(app, true);

        // Empty state + the link affordance are shown.
        await expect(teamContent(app).getByText(/No membership policy assigned/i)).toBeVisible();
        await expect(teamContent(app).locator('[data-testid="link-to-a-policy"]')).toBeVisible();

        // Saving with nothing defined disables ABAC instead of blocking with an error.
        await app.admin.team.savePanel.saveButton.click();
        await expect(
            teamContent(app).getByText(/must select a membership policy or define custom access rules/i),
        ).toHaveCount(0);

        // Enforcement stays off on the server.
        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should remain not policy-enforced after saving an empty ABAC config',
            })
            .toBeFalsy();
    });

    /**
     * @objective The Membership Policies list "Applies to" column reflects assigned teams,
     * proving the channel/team count split (props.team_count) renders.
     */
    test('MM-68846-T6 - policy list shows the team count after assignment', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Team Count Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;

        await page.goto(systemConsolePath('system_attributes/membership_policies'));
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
        test.setTimeout(duration.two_min);
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

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT9 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT9;

        // # Enable the enforce toggle
        await setToggle(app, true);

        // * Custom-rules panel appears
        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // # Add Engineering rule against the panel container
        await addAttributeRule(rulesPanel, page, 'Engineering');

        // # Save via page-level SaveChangesPanel
        await app.admin.team.savePanel.saveButton.click();

        // * Save-confirm modal appears with the affected-count text
        const confirmModal = app.admin.team.saveConfirmModal.locator;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});
        await expect(confirmModal.getByText(/\d+ members? do(?:es)? not currently meet the criteria/i)).toBeVisible();

        // # Click Apply
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect(confirmModal).not.toBeVisible();

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
        test.setTimeout(duration.two_min);
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

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT10 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT10;

        // # Enable enforce toggle
        await setToggle(app, true);

        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // The auto-add checkbox has no generated part; its DOM id is scoped to this team form.
        const autoAddCheckbox = teamContent(app).locator('[data-testid="team-auto-add-members-checkbox"]');

        // * Auto-add is disabled while editor is empty
        await expect(autoAddCheckbox).toBeDisabled();

        // # Add a rule — checkbox should enable
        await addAttributeRule(rulesPanel, page, 'Engineering');
        await expect(autoAddCheckbox).toBeEnabled();

        // # Enable auto-add and record time before save
        await autoAddCheckbox.click();
        await expect(autoAddCheckbox).toBeChecked();
        const testStartTime = Date.now();

        // # Save
        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal.locator;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});
        await confirmModal.getByRole('button', {name: 'Apply'}).click();
        await expect(confirmModal).not.toBeVisible();

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
        test.setTimeout(duration.two_min);
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

        // # Private team; admin is NOT a member, only a Marketing user (doesn't match Engineering).
        // Remove the admin (auto-added on create). A shared system admin may have
        // Department=Engineering from another worker, which would hide the empty-team warning.
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        await adminClient.removeFromTeam(team.id, adminUser.id).catch(() => {});
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

        // # An Engineering user who is NOT on the team. This makes the "Engineering"
        // # attribute value indexed so the save-confirm count query resolves with data
        // # (a rule whose value was never attributed to anyone can otherwise fail to
        // # evaluate) — while keeping the team's sole member non-qualifying.
        const engUser = await adminClient.createUser(
            {
                email: `eng${suffix}@sample.mattermost.com`,
                username: `eng${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(engUser.id);
        await setUserAttribute(adminClient, engUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [mktUser.id]);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [engUser.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT11 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT11;

        // # Enable enforce toggle
        await setToggle(app, true);

        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // # Add Engineering rule — no current member matches
        await addAttributeRule(rulesPanel, page, 'Engineering');

        await app.admin.team.savePanel.saveButton.click();

        const confirmModal = app.admin.team.saveConfirmModal.locator;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});

        // * Empty-team warning present
        await expect(confirmModal.getByText(/No current members meet the criteria/i)).toBeVisible();

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
        test.setTimeout(duration.two_min);
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

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT12 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT12;

        // # Enable the toggle and link the parent policy (no custom rules added)
        await setToggle(app, true);
        await teamContent(app).locator('[data-testid="link-to-a-policy"]').click();
        // The membership chooser is portalled and has no generated scope; its dialog title identifies it.
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await expect(modal).toBeVisible({timeout: duration.ten_sec});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        // The linked-policy panel has no generated scope; its DOM id is bounded by the identified team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        // # Save to open the affected-count confirmation
        await app.admin.team.savePanel.saveButton.click();
        const confirmModal = app.admin.team.saveConfirmModal.locator;
        await expect(confirmModal).toBeVisible({timeout: duration.half_min});

        // * Exactly one member (the non-matching Marketing user) is affected — not both.
        await expect(confirmModal.getByText(/1 member does not currently meet the criteria/i)).toBeVisible();
        await expect(confirmModal.getByText(/2 members do not currently meet the criteria/i)).toHaveCount(0);

        // * The qualifying member is counted, so the empty-team warning must NOT appear.
        await expect(confirmModal.getByText(/No current members meet the criteria/i)).toHaveCount(0);

        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();
    });

    /**
     * @objective The per-row Remove action opens a disconnect confirmation with the
     * policy name and non-destructive-cancel behavior; only confirming stages removal.
     */
    test('MM-68846-T13 - disconnecting a policy requires confirming a named dialog', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Disconnect Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT13 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT13;

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        // The linked-policy panel has no generated scope; its DOM id is bounded by the identified team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their legacy ids, classes and accessible names.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible({
            timeout: duration.half_min,
        });

        // # Open the disconnect confirmation
        await teamContent(app).getByLabel('Remove policy').click();
        // The removal confirmation has no generated scope; its title identifies the portalled dialog.
        const disconnectModal = page.locator('.ConfirmModal').filter({hasText: 'Remove this team from policy'});
        await expect(disconnectModal).toBeVisible();

        // * Dialog names the policy and explains members are retained
        await expect(disconnectModal.getByText(policyName)).toBeVisible();
        await expect(disconnectModal.getByText(/Existing members are retained/i)).toBeVisible();

        // # Cancel is non-destructive — the policy stays linked
        await disconnectModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(disconnectModal).not.toBeVisible();
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        // # Confirming removes it from the list (staged until save)
        await teamContent(app).getByLabel('Remove policy').click();
        await expect(disconnectModal).toBeVisible();
        await disconnectModal.getByRole('button', {name: 'Remove policy'}).click();
        await expect(disconnectModal).not.toBeVisible();
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
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
        test.setTimeout(duration.two_min);
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

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT14 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT14;

        await setToggle(app, true);
        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        const addAttribute = async () => {
            // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their legacy ids, classes and accessible names.
            const rows = rulesPanel.locator('.table-editor__row');
            const before = await rows.count();
            await rulesPanel.getByRole('button', {name: /Add attribute/}).click();
            // The attribute picker is portalled outside the rules panel and has no generated scope.
            const attrMenu = page.locator('[id^="attribute-selector-menu"]');
            await expect(attrMenu).toBeVisible({timeout: duration.ten_sec});
            // Attribute choices have no generated parts; select the named option within the native picker.
            await attrMenu.locator('li').filter({hasText: 'Department'}).first().click();
            await expect(rows).toHaveCount(before + 1);
        };

        // # Add the first rule row (Department, default operator)
        await addAttribute();
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(1);

        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        const row1 = rulesPanel.locator('.table-editor__row').first();

        // # Switch the operator to a multi-value operator ("in")
        // The rules editor has no generated selector buttons; use the control id within this rule row.
        await row1.locator('[data-testid="operatorSelectorMenuButton"]').click();
        // The membership policy panel, its table editor and the Monaco/CEL editor declare no parts: addressed by their legacy ids, classes and accessible names.
        await expect(page.getByRole('menuitemradio', {name: 'in', exact: true})).toBeVisible();
        await page.getByRole('menuitemradio', {name: 'in', exact: true}).click();
        // The rules editor has no generated selector buttons; use the control id within this rule row.
        await expect(row1.locator('[data-testid="operatorSelectorMenuButton"]')).toContainText('in');

        // # Enter multiple values — each Enter creates a chip
        // The rules editor has no generated selector buttons; use the control id within this rule row.
        await row1.locator('[data-testid="valueSelectorMenuButton"]').click();
        const valueFilter = page.locator('#filter_values');
        await expect(valueFilter).toBeVisible();
        await valueFilter.fill('Engineering');
        await valueFilter.press('Enter');
        // Selected value chips have no generated parts; inspect their labels and count within this rule row.
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Engineering'})).toBeVisible();
        await valueFilter.fill('Marketing');
        await valueFilter.press('Enter');
        // Selected value chips have no generated parts; inspect their labels and count within this rule row.
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Marketing'})).toBeVisible();

        // Close the value menu (click-away) so its overlay doesn't intercept later clicks.
        // Escape is swallowed by the filter input, so click a neutral spot instead.
        await page.mouse.click(5, 5);
        // The hierarchical value menu has no generated root in this report.
        await expect(page.locator('#value-selector-menu')).toBeHidden();

        // * Two chips are present on the row
        // Selected value chips have no generated parts; inspect their labels and count within this rule row.
        await expect(row1.locator('.select__multi-value')).toHaveCount(2);
        // Selected value chips have no generated parts; inspect their labels and count within this rule row.
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Engineering'})).toBeVisible();
        // Selected value chips have no generated parts; inspect their labels and count within this rule row.
        await expect(row1.locator('.select__multi-value__label').filter({hasText: 'Marketing'})).toBeVisible();

        // # Add a second rule row
        await addAttribute();
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(2);

        // # Delete the first row
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await rulesPanel.locator('.table-editor__row-remove').first().click();
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(1);

        // # Delete the remaining row — the editor returns to the blank state
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await rulesPanel.locator('.table-editor__row-remove').first().click();
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
        await expect(rulesPanel.locator('.table-editor__row')).toHaveCount(0);
        // Rule rows and their remove controls have no generated parts; inspect them within the rules panel.
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
        test.setTimeout(duration.two_min);
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

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT15 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT15;

        const testStartTime = Date.now();

        // # Enable the toggle and link the parent policy — leave auto-add OFF.
        await setToggle(app, true);
        // The policy-link control has no generated part; its DOM id is bounded by this team form.
        await teamContent(app).locator('[data-testid="link-to-a-policy"]').click();
        // The membership chooser is portalled and has no generated scope; its dialog title identifies it.
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await expect(modal).toBeVisible({timeout: duration.ten_sec});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        // The linked-policy panel has no generated scope; its DOM id is bounded by the identified team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        // # Save and confirm the apply dialog.
        await app.admin.team.savePanel.saveButton.click();
        const applyBtn = app.admin.team.saveConfirmModal.confirmButton;
        await expect(applyBtn).toBeVisible();
        await Promise.all([waitForApi(page, Api.PatchTeam, {params: {team_id: team.id}}), applyBtn.click()]);
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
                    timeout: duration.half_min,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'linking a parent policy should enqueue a team sync job on save',
                },
            )
            .toBe(true);
    });

    /**
     * @objective Sync status footer appears inside the Team-specific membership rules panel
     * for a team that already has a persisted membership policy, showing "Never synced."
     * and a "Sync now" link for a team that has not yet been synced.
     */
    test('MM-68846-T16 - sync footer appears for a team with a persisted membership policy', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A team already governed by a saved policy (persisted server-side).
        const policyName = `Sync Footer Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT16 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT16;

        // * Team-specific membership rules panel is shown
        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // * Sync footer is rendered inside the panel once the job-status fetch resolves
        // The sync footer has no generated parts; inspect its status and link within the rules panel.
        const syncFooter = rulesPanel.locator('.SyncStatusFooter');
        await expect(syncFooter).toBeVisible();

        // * "Never synced." text is shown — no sync has run for this brand-new team
        await expect(syncFooter.locator('.SyncStatusFooter__text')).toContainText(/Never synced/i);

        // * "Sync now" link is present
        // The sync footer has no generated parts; inspect its status and link within the rules panel.
        await expect(syncFooter.locator('.SyncStatusFooter__link')).toBeVisible();
    });

    /**
     * @objective The sync footer stays hidden until a membership policy is persisted:
     * enabling enforcement and staging a policy link (before the first Save) exposes
     * nothing to sync, so "Sync now" must not be offered.
     */
    test('MM-68846-T23 - sync footer is hidden before the first policy is saved', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Unsaved Footer Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);

        const {app} = await pw.testBrowser.login(adminUser);
        const {page} = app;
        const policyFetchDoneT23 = page
            .waitForResponse((resp) => resp.url().includes(`/teams/${team.id}/access_control/policy`), {
                timeout: duration.half_min,
            })
            .catch(() => {});
        await openTeamConfig(app, team.display_name);
        await policyFetchDoneT23;

        // # Enable enforcement and stage a policy link, but do NOT save.
        await setToggle(app, true);
        // The generated surface has no member for the rules editor's internal controls.
        const rulesPanel = teamContent(app).locator('#team_level_access_rules');
        await expect(rulesPanel).toBeVisible();

        // The policy-link control has no generated part; its DOM id is bounded by this team form.
        await teamContent(app).locator('[data-testid="link-to-a-policy"]').click();
        // The membership chooser is portalled and has no generated scope; its dialog title identifies it.
        const modal = page.locator('[role="dialog"]').filter({hasText: 'Select a Membership Policy'});
        await expect(modal).toBeVisible({timeout: duration.ten_sec});
        const policyRow = await findPolicyRow(modal, policyName);
        await policyRow.click();

        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        // The linked-policy panel has no generated scope; its DOM id is bounded by the identified team form.
        const policyPanel = teamContent(app).locator('#team_access_control_with_policy');
        // The linked-policy panel and name have no generated parts; inspect them within this team form.
        await expect(policyPanel.locator('.policy-name').filter({hasText: policyName})).toBeVisible();

        // * No persisted policy yet, so the sync footer (and its "Sync now") is withheld.
        await expect(rulesPanel.locator('.SyncStatusFooter')).toHaveCount(0);
    });
});
