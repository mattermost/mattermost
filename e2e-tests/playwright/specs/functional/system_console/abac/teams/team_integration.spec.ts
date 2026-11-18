// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Team} from '@mattermost/types/teams';

import {
    Api,
    type App,
    expect,
    newTestPassword,
    settle,
    test,
    waitForApi,
    duration,
    Msg,
} from '@mattermost/playwright-lib';

import {
    createPrivateTeam,
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    getTeamAccessControlPolicy,
    getTeamAutoAddMode,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {getUserAttributeFieldByName} from '../support';
import {addRule, fillRuleValue, MEMBERSHIP_POLICIES_PATH} from '../surface';

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
     * Opens a team's page in the System Console and waits for its membership policy to load: the page fetches it on
     * mount, and a response landing after the toggle is switched on would switch it back off.
     */
    async function openTeamConfig(app: App, team: Team) {
        await Promise.all([
            waitForApi(app.page, Api.GetTeamAccessControlPolicy, {params: {team_id: team.id}}),
            app.page.goto(`/admin_console/user_management/teams/${team.id}`),
        ]);
        await expect(app.admin.team.policyEnforce.container).toBeVisible();
        return app.admin.team;
    }

    /** Links a membership policy from the selection dialog and waits for it to be listed on the page. */
    async function linkPolicy(app: App, page: App['admin']['team'], policy: {id: string; name: string}) {
        const policySelectionModal = app.policySelectionModal;
        await page.accessPolicy.linkButton.click();
        await expect(policySelectionModal.container).toBeVisible();
        const {policies} = policySelectionModal;

        // the list loads its first page on open, and that response can replace a search's results
        await expect(await policies.rowList.first()).toBeVisible();
        await policies.searchTextbox.fill(policy.name);
        await expect(policies.row(policy.id)).toBeVisible();
        // The DataGrid name cell opens the editor but has no operable role or click driver.
        await policies.row(policy.id).cell('name').click();
        await expect(page.accessPolicy.policy(policy)).toBeVisible();
        await expect(page.accessPolicy.policy(policy).nameText).toHaveText(policy.name);
    }

    /** A successful save returns to the Teams list. */
    async function expectSaved(app: App) {
        await expect(app.page).toHaveURL(/\/user_management\/teams$/);
    }

    /** Saves the page and confirms the "Apply membership policy" dialog. */
    async function saveAndApply(app: App, page: App['admin']['team']) {
        await page.savePanel.saveButton.click();
        const confirm = page.saveConfirmModal;
        await expect(confirm).toBeVisible();
        await expect(confirm.confirmButton).toHaveText(/Apply/);
        await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirm).not.toBeVisible();
        await expectSaved(app);
    }

    /** Removes a linked policy, confirming the disconnect dialog. */
    async function removePolicy(page: App['admin']['team'], policy: {id: string}) {
        await page.accessPolicy.policy(policy).removeButton.click();
        const disconnect = page.removePolicyModal;
        await expect(disconnect).toBeVisible();
        await expect(disconnect).toContainText('Remove this team from policy');
        await disconnect.confirmButton.click();
        await expect(disconnect).not.toBeVisible();
    }

    /** Adds a `Department == value` rule to the team's own rules. */
    async function addDepartmentRule(client: Client4, page: App['admin']['team'], value: string) {
        const department = await getUserAttributeFieldByName(client, 'Department');
        await expect(page.accessRules.rules.addButton).toBeEnabled();
        await addRule(page.accessRules.rules, {field: department, value});
    }

    /** Whether a team sync job for this team was created since `since`. */
    async function teamSyncJobSince(client: Client4, team: {id: string}, since: number) {
        const jobs: any[] = await (client as any).doFetch(
            `${client.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {
                method: 'GET',
            },
        );
        return jobs.some((j: any) => j.data?.policy_id === team.id && j.create_at >= since);
    }

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

        // # Assign: turn attribute-based access on, link the policy, save and apply
        let page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        await linkPolicy(app, page, policy);
        await saveAndApply(app, page);

        // * The team becomes policy-enforced
        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team should become policy-enforced after assigning a policy',
            })
            .toBe(true);

        // # Remove: the reopened page lists the assigned policy; remove it and save
        page = await openTeamConfig(app, team);
        await expect(page.accessPolicy.policy(policy).nameText).toHaveText(policyName);
        await removePolicy(page, policy);

        // * Removing the last policy turns enforcement off by itself, so Save goes straight through with no
        // "Apply membership policy" dialog
        await settle(page.savePanel.saveButton, {wait: Api.PatchTeam}).click();
        await expectSaved(app);
        await expect(page.saveConfirmModal.confirmButton).toHaveCount(0);

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

        // # Link the policy and add a custom rule, then persist both in one save
        let page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        await linkPolicy(app, page, policy);
        await addDepartmentRule(adminClient, page, 'Engineering');
        await saveAndApply(app, page);

        // # Re-open and remove the policy; the custom rule stays
        page = await openTeamConfig(app, team);
        await expect(page.accessPolicy.policy(policy).nameText).toHaveText(policyName);
        await removePolicy(page, policy);

        // * Custom rule still governs, so enforcement stays on
        await expect(page.policyEnforce.container).toBeOn();

        // * Save goes straight through: removal is not new criteria, so no apply dialog
        await settle(page.savePanel.saveButton, {wait: Api.PatchTeam}).click();
        await expectSaved(app);
        await expect(page.saveConfirmModal.confirmButton).toHaveCount(0);

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
        await app.page.goto(`/admin_console/user_management/teams/${team.id}`);
        const page = app.admin.team;

        // * The toggle is disabled, and its help explains why
        await expect(page.policyEnforce.container).toBeDisabled();
        await expect(page.policyEnforce.helpText).toContainText(/Group synced teams cannot use a membership policy/i);

        // # Turn group sync off and reload
        await adminClient.patchTeam({id: team.id, group_constrained: false} as any);
        await app.page.reload();

        // * The toggle is usable, and its help no longer mentions group sync
        await expect(page.policyEnforce.container).toBeEnabled();
        await expect(page.policyEnforce.helpText).not.toContainText(/Group synced/i);
    });

    /**
     * @objective Enabling attribute-based access shows the empty state and the link
     * affordance. Saving with nothing defined (no linked policy, no custom rule) turns
     * ABAC back off cleanly rather than erroring — the team is never left enforced-but-empty.
     */
    test('MM-68846-T5 - enabling the toggle with nothing defined saves cleanly and leaves ABAC off', async ({pw}) => {
        test.setTimeout(duration.two_min);

        // Known bug: with nothing defined, Save tries to delete a team policy that doesn't exist. The server answers
        // "Unable to retrieve the access control policy.", which team_details.tsx only treats as harmless when the
        // message says "not found", so the save is refused with that error and the page stays put. This is expected to
        // fail until that's fixed, and Playwright reports it once it passes: then remove test.fail().
        test.fail();
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();

        // * The empty state and the link affordance are shown
        await expect(page.accessPolicy.emptyText).toContainText(/No membership policy assigned/i);
        await expect(page.accessPolicy.linkButton).toBeVisible();

        // * Saving with nothing defined goes through (turning attribute-based access off) instead of blocking with
        // an error
        await settle(page.savePanel.saveButton, {wait: Api.PatchTeam}).click();
        await expectSaved(app);
        // The blocking error has no part of its own (the text is not rendered anywhere), so its absence is read by text.
        await expect(app.page.getByText(/must select a membership policy or define custom access rules/i)).toHaveCount(
            0,
        );

        // * Enforcement stays off on the server
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
        await app.page.goto(MEMBERSHIP_POLICIES_PATH);
        const {policies} = app.admin.accessControl;

        // * Filtered to our policy (stable under parallel runs), its row counts the one team
        await expect(await policies.rowList.first()).toBeVisible();
        await policies.searchTextbox.fill(policyName);
        await expect(policies.row(policy.id)).toContainText('1 team');
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();

        // # Add a custom rule and save
        await addDepartmentRule(adminClient, page, 'Engineering');
        await page.savePanel.saveButton.click();

        // * The confirmation counts the members who don't meet it
        const confirm = page.saveConfirmModal;
        await expect(confirm).toContainText(/\d+ members? do(?:es)? not currently meet the criteria/i);

        // # Apply
        await settle(confirm.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expectSaved(app);

        // * The rule persisted
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        const autoAdd = page.autoAddMembersCheckbox;

        // * Auto-add is disabled until a rule exists
        await expect(autoAdd).toBeDisabled();
        await addDepartmentRule(adminClient, page, 'Engineering');
        await expect(autoAdd).toBeEnabled();

        // # Turn auto-add on, save and apply
        await page.autoAddMembersCheckbox.set(true);
        await expect(autoAdd).toBeChecked();
        const testStartTime = Date.now();
        await saveAndApply(app, page);

        // * A team sync job was created
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();

        // # Add a rule no current member meets, and save
        await addDepartmentRule(adminClient, page, 'Engineering');
        await page.savePanel.saveButton.click();

        // * The confirmation warns that no current member meets it
        const confirm = page.saveConfirmModal;
        await expect(confirm).toContainText(/No current members meet the criteria/i);

        // # Cancel
        await confirm.cancelButton.click();
        await expect(confirm.cancelButton).not.toBeVisible();
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        await linkPolicy(app, page, policy);
        await page.savePanel.saveButton.click();

        // * Exactly one member (the Marketing one) is counted as not meeting the linked policy, never both, and the
        // empty-team warning doesn't show
        const confirm = page.saveConfirmModal;
        await expect(confirm).toContainText(/1 member does not currently meet the criteria/i);
        await expect(confirm).not.toContainText(/2 members do not currently meet the criteria/i);
        await expect(confirm).not.toContainText(/No current members meet the criteria/i);

        await confirm.cancelButton.click();
        await expect(confirm.cancelButton).not.toBeVisible();
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
        const page = await openTeamConfig(app, team);
        const linked = page.accessPolicy.policy(policy);
        await expect(linked.nameText).toHaveText(policyName);

        // # Remove, then cancel the disconnect dialog
        await linked.removeButton.click();
        const disconnect = page.removePolicyModal;

        // * The dialog names the policy and says existing members stay
        await expect(disconnect).toContainText(policyName);
        await expect(disconnect).toContainText(/Existing members are retained/i);

        // * Cancelling keeps the policy listed
        await disconnect.cancelButton.click();
        await expect(disconnect.cancelButton).not.toBeVisible();
        await expect(linked.nameText).toHaveText(policyName);

        // * Confirming removes it from the list
        await removePolicy(page, policy);
        await expect(linked).toHaveCount(0);
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        const {rules} = page.accessRules;
        const department = await getUserAttributeFieldByName(adminClient, 'Department');

        // # A first row, with the multi-value "in" operator and two values
        const row1 = await addRule(rules, {field: department, operator: 'in', value: 'Engineering'});
        await expect(rules.rowList).toHaveKeyCount(1);
        await expect(row1.operatorButton).toContainText('in');
        await fillRuleValue(row1, 'Marketing');

        // * Both values show as chips
        await expect(row1.value.chipList).toHaveKeys([0, 1]);
        await expect(row1.value.chip(0)).toHaveText('Engineering');
        await expect(row1.value.chip(1)).toHaveText('Marketing');

        // # A second row
        await rules.addButton.click();
        await expect(rules.row(1).attributeMenu.container).toBeVisible();
        await rules.row(1).attributeMenu.attribute(department).click();
        await expect(rules.rowList).toHaveKeyCount(2);

        // # Delete both rows
        await rules.row(0).removeButton.click();
        await expect(rules.rowList).toHaveKeyCount(1);
        await rules.row(0).removeButton.click();

        // * The table is back to its blank state
        await expect(rules.rowList).toHaveKeyCount(0);
        await expect(rules.blankStateText).toBeVisible();
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
        const page = await openTeamConfig(app, team);
        const testStartTime = Date.now();

        // # Link the parent policy, save and apply
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        await linkPolicy(app, page, policy);
        await saveAndApply(app, page);

        // * A team sync job for this team was created
        await expect
            .poll(async () => teamSyncJobSince(adminClient, team, testStartTime), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 3000],
                message: 'linking a parent policy should enqueue a team sync job on save',
            })
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
        const page = await openTeamConfig(app, team);

        // * The rules panel shows the sync footer: never synced yet, with "Sync now"
        const {syncStatus} = page.accessRules;
        await expect(syncStatus.timeText).toContainText(/Never synced/i);
        await expect(syncStatus.syncNowButton).toBeVisible();
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
        const page = await openTeamConfig(app, team);
        await page.policyEnforce.container.set(true);
        await expect(page.policyEnforce.container).toBeOn();
        await expect(page.accessRules.titleText).toBeVisible();

        // # Link a policy without saving
        await linkPolicy(app, page, policy);

        // * No sync footer until the policy is saved
        await expect(page.accessRules.syncStatus).toHaveCount(0);
    });

    /**
     * @objective Clicking "Sync now" in the Team-specific membership rules panel of the
     * Team Details admin page enqueues an access_control_team_sync job scoped
     * to the team.
     */
    test('MM-68846-T17 - clicking "Sync now" in Team Details Team-specific membership rules panel enqueues a team sync job', async ({
        pw,
    }) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A team already governed by a saved policy so the sync footer is offered.
        const policyName = `Sync Now Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const {syncStatus} = page.accessRules;
        await expect(syncStatus.syncNowButton).toBeVisible();

        // # Sync now
        const testStartTime = Date.now();
        await syncStatus.syncNowButton.click();

        // * A team sync job for this team was created
        await expect
            .poll(async () => teamSyncJobSince(adminClient, team, testStartTime), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 3000],
                message: 'clicking Sync now in Team Details should enqueue a team sync job for this team',
            })
            .toBe(true);
    });

    /**
     * @objective The System Console Teams list distinguishes a policy-governed team from a
     * plain invite-only team: its Management column reads "Attribute Based", not "Invite Only".
     */
    test('MM-68846-T18 - Teams list shows an Attribute Based indicator for a policy-governed team', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A private team governed by a membership policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const policyName = `Indicator Policy ${suffix}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        await app.page.goto('/admin_console/user_management/teams');
        const {teams} = app.admin;

        // # Search for the team
        await settle(teams.searchTextbox, {wait: Api.SearchTeams}).fill(team.display_name);

        // * Its management column reads "Attribute Based"
        await expect(teams.row(team.id).cell('management')).toHaveText('Attribute Based');
    });

    /**
     * @objective Opening a linked policy in the editor from the team page and navigating
     * back does not raise a spurious "Discard Changes?" prompt for the team page's leftover
     * unsaved state — the editor clears the stale navigation-block flag on entry.
     */
    test('MM-68846-T19 - opening a policy in the editor does not carry over a false discard prompt', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Editor Nav Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const linked = page.accessPolicy.policy(policy);
        await expect(linked.nameText).toHaveText(policyName);

        // # Make an unsaved change, then open the policy
        await page.autoAddMembersCheckbox.set(true);
        await expect(page.autoAddMembersCheckbox).toBeChecked();
        await linked.openLink.click();

        // * The policy editor opens
        await expect(app.page).toHaveURL(/membership_policies\/edit_policy\//, {timeout: duration.half_min});
        await expect(app.admin.header).toContainMessage(Msg.admin.access_control.policy.edit_policy.title);

        // # Go back to the list
        await app.admin.accessControl.policy.backLink.click();

        // * No stale "Discard Changes?" prompt; the list opens
        await expect(app.page).toHaveURL(/membership_policies$/);
        await expect(app.admin.accessControl.policies.searchTextbox).toBeVisible();
    });

    /**
     * @objective The Membership policies table exposes only Policy Name and Actions —
     * auto-add is a single team-level flag owned by the rules section, not a per-policy
     * column, so the table carries no auto-add checkbox. The rules section is titled
     * "Team-specific membership rules".
     */
    test('MM-68846-T21 - membership policies table has no auto-add column and the rules section is renamed', async ({
        pw,
    }) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        const policyName = `Table Layout Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const {accessPolicy} = page;
        await expect(accessPolicy.policy(policy).nameText).toHaveText(policyName);

        // * The policy list has Policy Name and Actions columns, and no Auto-add column or checkboxes
        await expect(accessPolicy.header).toContainMessage(
            Msg.admin.team_settings.team_detail.access_control_policy_name,
        );
        await expect(accessPolicy.header).toContainMessage(
            Msg.admin.team_settings.team_detail.access_control_policy_actions,
        );
        await expect(accessPolicy.header).not.toContainText('Auto-add');

        // * The rules section is called "Team-specific membership rules"
        await expect(page.accessRules.titleText).toHaveMessage(Msg.admin.team_settings.team_detail.rules.title);
    });

    /**
     * @objective A team governed only by an imported parent policy (no custom rule) can
     * still toggle auto-add — the rules-section checkbox is enabled even with an empty
     * custom expression — and toggling it persists the auto-add mode on the team child
     * policy's membership rule.
     */
    test('MM-68846-T22 - auto-add is interactive for a parent-only team and persists on save', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        cleanupClient = adminClient;
        await enableTeamMembershipPolicies(adminClient);

        // # A parent-governed team with no custom rule (assigned inactive by default).
        const policyName = `Parent Only Policy ${pw.random.id()}`;
        const policy = await createTeamMembershipParentPolicy(adminClient, policyName, 'true');
        createdPolicyIds.push(policy.id);
        await assignTeamsToPolicy(adminClient, policy.id, [team.id]);

        const {app} = await pw.testBrowser.login(adminUser);
        const page = await openTeamConfig(app, team);
        const autoAdd = page.autoAddMembersCheckbox;

        // * Auto-add is interactive with only a parent policy linked, and off
        await expect(autoAdd).toBeEnabled();
        await expect(autoAdd).not.toBeChecked();

        // # Turn it on, save and apply
        await page.autoAddMembersCheckbox.set(true);
        await expect(autoAdd).toBeChecked();
        await saveAndApply(app, page);

        // * It persisted on the team's child policy
        await expect
            .poll(async () => getTeamAutoAddMode(adminClient, team.id), {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 2000],
                message: 'team child policy auto-add mode should persist after enabling auto-add',
            })
            .toBe('always');
    });
});
