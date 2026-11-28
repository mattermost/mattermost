// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Team Membership tab
 * @reference MM-69100
 */

import {
    Api,
    settle,
    deleteAccessControlPolicyIfPresent,
    duration,
    expect,
    ignoreMissing,
    Msg,
    newTestPassword,
    test,
} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createTeamMembershipPolicy,
    getTeamAccessControlPolicyIfPresent,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
    waitForAttributeViewToExclude,
    addRule,
    createParentPolicy,
    assignTeamToParentPolicy,
} from './helpers';
import {closeTeamSettings, openTeam, openTeamMembershipTab, openTeamSettings} from './surface';

test.describe('Team Settings Modal - Team Membership Tab', {tag: ['@abac', '@team_membership']}, () => {
    const createdPolicyIds: string[] = [];
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdPolicyIds.splice(0)) {
            await deleteAccessControlPolicyIfPresent(adminClient, id);
        }
        for (const id of createdTeamIds.splice(0)) {
            await ignoreMissing(() => adminClient.deleteTeam(id));
        }
        for (const id of createdUserIds.splice(0)) {
            await ignoreMissing(() => adminClient.updateUserActive(id, false));
        }
    });

    test('MM-69100_8 Team Membership tab visible for system admin with ABAC + FF enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamSettings(app);

        // * Team Membership tab button is visible
        await expect(teamSettings.tabs.tab('team_membership')).toBeVisible();

        // # Click Team Membership tab
        await teamSettings.tabs.tab('team_membership').select();
        const tab = teamSettings.membership.locator;
        await expect(tab).toBeVisible();

        // * Tab title is visible
        await expect(teamSettings.membership.titleText).toHaveMessage(Msg.team_settings.membership_tab.title);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_9 Team Membership tab visible for team admin', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamSettings(app);

        // * Team Membership tab button is visible for team admin
        await expect(teamSettings.tabs.tab('team_membership')).toBeVisible();

        await teamSettings.tabs.tab('team_membership').select();
        await expect(teamSettings.membership).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_10 Empty state: no banner, table editor visible, auto-add disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * No system policy banner (no parent policy assigned)
        await expect(tab.systemPolicies).not.toBeVisible();

        // * Table editor is present
        await expect(tab.rules).toBeVisible();

        // * Auto-add checkbox is disabled (no rules yet)
        await expect(tab.autoAddCheckbox).toBeDisabled();

        // * No SaveChangesPanel (nothing is dirty)
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_11 System policy InfoBanner visible when team is assigned to a parent policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a parent policy and assign the team to it
        const policyName = `Global Team Policy ${pw.random.id()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        createdPolicyIds.push(policy.id);
        await assignTeamToParentPolicy(adminClient, policy.id, team.id);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * System policy banner is visible
        await expect(tab.systemPolicies).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-70056_1 System policy InfoBanner visible to a TEAM ADMIN when the team is assigned to a parent policy', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a parent policy and assign the team to it
        const policyName = `Global Team Policy ${pw.random.id()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        createdPolicyIds.push(policy.id);
        await assignTeamToParentPolicy(adminClient, policy.id, team.id);

        // # Log in as a TEAM ADMIN (only ManageTeamAccessRules, not ManageSystem)
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Banner is visible to the team admin, not just the system admin (MM-70056),
        // and names the resolved parent policy.
        const banner = tab.systemPolicies.locator;
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(policyName);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_12 Auto-add disabled with no expression, enabled after adding a rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Auto-add starts disabled (empty expression)
        await expect(tab.autoAddCheckbox).toBeDisabled();

        // # Add an attribute rule
        await addRule(tab.rules, department, 'Engineering');

        // * Auto-add checkbox becomes enabled
        await expect(tab.autoAddCheckbox).toBeEnabled();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_13 Save attribute rules without auto-add still triggers a sync job (immediate reconcile)', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add attribute rule (auto-add stays OFF)
        await addRule(tab.rules, department, 'Engineering');
        await expect(tab.autoAddCheckbox).toBeEnabled();

        // # Snapshot jobs for THIS team before saving. Filter by policy_id so
        // parallel workers and pre-existing jobs from other teams don't skew the count.
        const fetchTeamJobs = async () => {
            const all: any[] = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                {method: 'GET'},
            );
            return all.filter((j: any) => j.data?.policy_id === team.id);
        };
        const teamJobCountBefore = (await fetchTeamJobs()).length;

        // # Click Save → confirmation modal appears
        await teamSettings.savePanel.saveButton.click();

        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        // * Allowed count is at least 1 (adminUser matches Engineering)
        await expect(confirmModal).toContainText(/user.*match.*current rules/i);

        // # Confirm save
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * Policy is persisted via API
        const policyResult: any = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/teams/${team.id}/access_control/policy`,
            {method: 'GET'},
        );
        expect(JSON.stringify(policyResult)).toContain('Engineering');

        // * A sync job WAS created for this team even though auto-add is OFF —
        // membership changes must apply on save, not wait for the hourly scheduler.
        // On a strict (private) team the reconcile removes non-qualifying members;
        // on advisory teams the worker no-ops, but the job is still enqueued.
        await expect
            .poll(async () => (await fetchTeamJobs()).length, {
                timeout: duration.half_min,
                intervals: [500, 1000, 2000, 3000],
                message: 'saving custom rules should enqueue a team sync job even with auto-add off',
            })
            .toBeGreaterThan(teamJobCountBefore);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_14 Enable auto-add on save triggers team sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add attribute rule
        await addRule(tab.rules, department, 'Engineering');
        await expect(tab.autoAddCheckbox).toBeEnabled();

        // # Enable auto-add
        await tab.autoAddCheckbox.set(true);
        await expect(tab.autoAddCheckbox).toBeChecked();

        // # Snapshot the most-recent job id right before saving.
        // Comparing IDs (not counts) is immune to the API page-size cap: once the
        // total job count reaches the default page size (~60 in CI), both before/after
        // snapshots return the same count even when a new job is created.
        const jobsBefore: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const latestJobIdBefore = jobsBefore[0]?.id ?? null;

        // # Save → confirmation modal
        await teamSettings.savePanel.saveButton.click();

        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        // # Confirm
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * A sync job was created — poll until a newer job appears at the top of the list
        await expect
            .poll(
                async () => {
                    const jobs: any[] = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                        {method: 'GET'},
                    );
                    return jobs[0]?.id !== latestJobIdBefore;
                },
                {timeout: duration.half_min, intervals: [500, 1000, 2000, 3000]},
            )
            .toBe(true);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_15 Toggling auto-add OFF and saving does NOT create a sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Make the admin match the rule so the self-exclusion check lets the save through
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        // # Create policy with auto-add=true via API, using a rule the Simple table can show
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Auto-add checkbox starts checked (the rule's auto_add was loaded)
        await expect(tab.autoAddCheckbox).toBeChecked();

        // # Uncheck auto-add
        await tab.autoAddCheckbox.set(false);
        await expect(tab.autoAddCheckbox).not.toBeChecked();

        // # Snapshot job count right before saving
        const jobsBefore: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const jobCountBefore = jobsBefore.length;

        // # Save → confirmation modal
        await teamSettings.savePanel.saveButton.click();

        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * No sync job was created (auto-add was turned OFF, not ON)
        const jobsAfter: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        expect(jobsAfter.length).toBe(jobCountBefore);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_16 Self-exclusion: admin blocked when their own rule would exclude them', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Ensure adminUser has NO Department attribute (a prior test may have set it to "Engineering").
        // Clear it and wait for the materialized AttributeView to reflect the removal so that
        // validateExpressionAgainstRequester correctly returns requester_matches=false.
        await setUserAttribute(adminClient, adminUser.id, 'Department', '');
        await waitForAttributeViewToExclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add rule that adminUser does NOT match
        await addRule(tab.rules, department, 'Engineering');

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        // * Self-exclusion modal appears, not the save confirmation modal
        const selfExclusion = tab.selfExclusionModal;
        await expect(selfExclusion).toContainText('Cannot save access rules');
        await expect(selfExclusion).toContainText(/you cannot set these rules/i);

        // * Save confirmation modal did NOT appear
        await expect(tab.rulesChangeModal).not.toBeVisible();

        // * "Back to editing" button is visible
        await expect(selfExclusion.confirmButton).toHaveText('Back to editing');

        // # Click Back to editing — self-exclusion modal closes
        await selfExclusion.confirmButton.click();
        await expect(selfExclusion).not.toBeVisible();

        // * Policy was NOT changed
        // No policy at all is fine: self-exclusion blocked the save.
        const policyResult = await getTeamAccessControlPolicyIfPresent(adminClient, team.id);
        expect(JSON.stringify(policyResult ?? {})).not.toContain('"Engineering"');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_43 Self-exclusion does not block on a public team (advisory)', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Make the team public (advisory mode)
        await adminClient.patchTeam({id: team.id, allow_open_invite: true});

        // # Ensure adminUser does NOT match the rule (would be self-exclusion on a private team)
        await setUserAttribute(adminClient, adminUser.id, 'Department', '');
        await waitForAttributeViewToExclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        await addRule(tab.rules, department, 'Engineering');
        await teamSettings.savePanel.saveButton.click();

        // * No self-exclusion block — the save proceeds to the normal confirmation
        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();
        await expect(tab.selfExclusionModal).not.toBeVisible();

        // * Confirmation uses advisory copy (no block/removal claims) on a public team
        await expect(confirmModal).toContainText(/these rules are advisory: no one is blocked or removed/i);
        await expect(confirmModal).not.toContainText(/may be affected/i);

        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_17 Save confirmation modal shows correct allowed and restricted counts', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Create 2 additional team members with different departments
        const suffix = pw.random.id();
        const createMember = async (dept: string, idx: number) => {
            const uid = `${suffix}m${idx}`;
            const user = await adminClient.createUser(
                {
                    email: `member${uid}@sample.mattermost.com`,
                    username: `member${uid}`,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            await adminClient.addToTeam(team.id, user.id);
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        const [user1, user2] = await Promise.all([createMember('Engineering', 1), createMember('Marketing', 2)]);
        createdUserIds.push(user1.id, user2.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
            adminUser.id,
            user1.id,
        ]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add attribute rule (Department == Engineering)
        await addRule(tab.rules, department, 'Engineering');

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        // * 2 users match (adminUser + user1). 2 members do not match: marketingUser plus
        //   the regular user that initSetup creates and adds to the team (no Department set).
        await expect(confirmModal).toContainText(/2 users match/i);
        await expect(confirmModal).toContainText(/2 current members do not match/i);

        // # Cancel without saving
        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_18 Confirmation modal shows restricted count when some team members do not match the rules', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Create a private team with adminUser as creator (automatically a member)
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Set adminUser's Department to Marketing so the rule doesn't self-exclude them
        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Marketing');

        // # Add one team member with Engineering (doesn't match Marketing rule)
        const uid = suffix;
        const engUser = await adminClient.createUser(
            {
                email: `eng${uid}@sample.mattermost.com`,
                username: `eng${uid}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(engUser.id);
        await adminClient.addToTeam(team.id, engUser.id);
        await setUserAttribute(adminClient, engUser.id, 'Department', 'Engineering');

        // Wait for BOTH users to appear in the attribute view so computeConfirmCounts
        // gets accurate counts (adminUser matches Marketing; engUser does not).
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Marketing"', [adminUser.id]);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [engUser.id]);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add rule: Department == Marketing (only adminUser matches)
        await addRule(tab.rules, department, 'Marketing');

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        // * Confirmation modal appears (self-exclusion passes since adminUser IS Marketing)
        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        // * 1 user matches (adminUser) and 1 member does not (engUser / Engineering)
        await expect(confirmModal).toContainText(/1 user matches/i);
        await expect(confirmModal).toContainText(/1 current member does not match/i);

        // # Cancel — don't save
        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_19 Existing rules and auto-add state load correctly when tab opened', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Pre-create policy with auto-add=true
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Auto-add is checked (auto_add was loaded from the API)
        await expect(tab.autoAddCheckbox).toBeChecked();

        // * Table editor is present and the panel is NOT shown (nothing is dirty after load)
        await expect(tab.rules).toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_42 Removing the last rule saves cleanly without a false error', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Pre-create a saved rule with auto-add ON (equivalent to "add a rule and save it")
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;
        await expect(tab.autoAddCheckbox).toBeChecked();

        // # Remove the only rule via the trash icon
        await tab.rules.row(0).removeButton.click();

        // * Auto-add is unchecked and disabled once no rules remain
        await expect(tab.autoAddCheckbox).not.toBeChecked();
        await expect(tab.autoAddCheckbox).toBeDisabled();

        // # Save → the removal warning (not the count modal) is shown
        await teamSettings.savePanel.saveButton.click();
        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.remove_title);
        await expect(confirmModal).toBeVisible();
        await expect(confirmModal).toContainText(/no longer be restricted by user attributes/i);
        await settle(confirmModal.confirmButton, {wait: Api.DeleteAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();

        // * Save succeeds: no "Failed to save access rules" error surfaces
        await expect(teamSettings.savePanel).not.toContainText('Failed to save access rules');
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * Policy is actually removed on the server
        const policyResult = await getTeamAccessControlPolicyIfPresent(adminClient, team.id);
        expect(JSON.stringify(policyResult ?? {})).not.toContain('Engineering');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_38 Sync footer shows "Never synced" in Team Membership tab when a policy exists', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Pre-create a team policy via API so hasPolicy=true when the tab loads
        await createTeamMembershipPolicy(adminClient, team.id, 'true', false);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Sync footer is visible once the job-status fetch resolves
        const syncFooter = tab.syncStatus;
        await expect(syncFooter).toBeVisible();

        // * "Never synced." is shown — no sync job has run for this brand-new team
        await expect(tab.syncStatus.timeText).toContainText(/Never synced/i);

        // * "Sync now" link is present
        await expect(tab.syncStatus.syncNowButton).toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_39 Clicking "Sync now" in Team Membership tab enqueues a team sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Pre-create a team policy so the sync footer renders
        await createTeamMembershipPolicy(adminClient, team.id, 'true', false);

        const app = await openTeam(pw, adminUser, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        const syncFooter = tab.syncStatus;
        await expect(syncFooter).toBeVisible();
        await expect(tab.syncStatus.syncNowButton).toBeVisible();

        const testStartTime = Date.now();

        // # Click "Sync now"
        await settle(tab.syncStatus.syncNowButton, {wait: Api.CreateJob}).click();

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
                    timeout: duration.half_min,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'clicking Sync now should enqueue a team sync job scoped to this team',
                },
            )
            .toBe(true);

        await closeTeamSettings(teamSettings);
    });
});
