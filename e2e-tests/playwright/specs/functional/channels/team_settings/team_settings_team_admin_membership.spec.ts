// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Team admin can manage team membership ABAC via the in-channel Team Settings modal
 * @reference MM-69100
 */

import {
    Api,
    settle,
    deleteAccessControlPolicyIfPresent,
    expect,
    ignoreMissing,
    newTestPassword,
    test,
    duration,
    Msg,
} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
    waitForAttributeViewToExclude,
    addRule,
    getTeamAccessControlPolicy,
    getTeamAccessControlPolicyIfPresent,
    createParentMembershipPolicy,
    assignTeamToParentPolicy,
} from './helpers';
import {closeTeamSettings, openAccessTab, openTeam, openTeamMembershipTab} from './surface';

test.describe('Team Settings Modal - Team Membership as Team Admin', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];
    const createdPolicyIds: string[] = [];

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

    test('MM-69100_24 team admin can save team membership rules and the policy persists', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Set teamAdmin Engineering so the rule does not self-exclude them
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add Engineering rule; leave auto-add OFF
        await addRule(tab.rules, department, 'Engineering');

        // # Save
        await teamSettings.savePanel.saveButton.click();
        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();

        // * Save panel disappears
        await expect(confirmModal).not.toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * Policy persisted — expression contains "Engineering"
        const policyResult: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(JSON.stringify(policyResult)).toContain('Engineering');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_25 team admin enabling auto-add triggers a team sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Set teamAdmin Engineering to avoid self-exclusion
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const testStartTime = Date.now();

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add rule and enable auto-add
        await addRule(tab.rules, department, 'Engineering');
        await expect(tab.autoAddCheckbox).toBeEnabled();
        await tab.autoAddCheckbox.set(true);
        await expect(tab.autoAddCheckbox).toBeChecked();

        // # Save
        await teamSettings.savePanel.saveButton.click();
        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();
        await settle(confirmModal.confirmButton, {wait: Api.CreateAccessControlPolicy}).click();
        await expect(confirmModal).not.toBeVisible();
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        // * A sync job was created (auto-add ON)
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBeGreaterThan(0);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_26 team admin is hard-blocked from saving a self-excluding rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # teamAdmin has NO Department — they do not match the Engineering rule
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await waitForAttributeViewToExclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add Engineering rule (teamAdmin would be excluded)
        await addRule(tab.rules, department, 'Engineering');

        // # Attempt save
        await teamSettings.savePanel.saveButton.click();

        // * Self-exclusion modal appears — not the save confirmation
        const selfExclusion = tab.selfExclusionModal;
        await expect(selfExclusion).toContainText('Cannot save access rules');
        await expect(selfExclusion).toContainText(/you cannot set these rules/i);
        await expect(tab.rulesChangeModal).not.toBeVisible();

        // * "Back to editing" button dismisses the self-exclusion modal
        await expect(selfExclusion.confirmButton).toHaveText('Back to editing');
        await selfExclusion.confirmButton.click();
        await expect(selfExclusion).not.toBeVisible();

        // * Policy unchanged via API
        // No policy at all is fine: self-exclusion blocked the save.
        const policyResult = await getTeamAccessControlPolicyIfPresent(adminClient, team.id);
        expect(JSON.stringify(policyResult ?? {})).not.toContain('"Engineering"');

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_27 team admin save-confirmation shows advisory copy on a public team', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        const department = await ensureDepartmentAttribute(adminClient);

        // # Fully public team (allow_open_invite=true so team admin can navigate to it)
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Create user1 (Engineering) and user2 (Marketing) and add them to the team
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

        const [user1, user2] = await Promise.all([createMember('Engineering', 1), createMember('Marketing', 2)]);
        createdUserIds.push(user1.id, user2.id);

        // # Set teamAdmin Engineering; remove adminUser so counts are predictable
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await adminClient.removeFromTeam(team.id, adminUser.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [
            teamAdmin.id,
            user1.id,
        ]);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // # Add Engineering rule
        await addRule(tab.rules, department, 'Engineering');

        // # Click Save
        await teamSettings.savePanel.saveButton.click();

        const confirmModal = tab.rulesChangeModal;
        await expect(confirmModal).toContainMessage(Msg.team_settings.membership_tab.confirm.title);
        await expect(confirmModal).toBeVisible();

        // * Advisory copy on a public team: match count shown, no removal/affected wording
        await expect(confirmModal).toContainText(/2 users match the current rules/i);
        await expect(confirmModal).toContainText(/these rules are advisory: no one is blocked or removed/i);
        await expect(confirmModal).not.toContainText(/does not match/i);
        await expect(confirmModal).not.toContainText(/may be affected/i);

        // # Cancel without saving
        await confirmModal.cancelButton.click();
        await expect(confirmModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_28 team admin can flip a governed public team to private and trigger a sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a fully public team
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Set teamAdmin Engineering so the flip does not remove them from the team
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # Attach a policy so team is policy_enforced (advisory while public)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const testStartTime = Date.now();

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessTab(app);

        // * Public card is initially selected
        await expect(teamSettings.access.discoverability.publicButton).toHaveClass(/selected/);

        // # Click Private card — mode-flip modal appears (policy_enforced=true triggers it)
        await teamSettings.access.discoverability.privateButton.click();

        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // * The modal warns that the flip activates strict ABAC enforcement.
        await expect(modeFlipModal).toContainText(/activate strict ABAC enforcement/i);

        // # Confirm the flip — confirming saves immediately (no second click)
        await modeFlipModal.confirmButton.click();
        await expect(modeFlipModal).not.toBeVisible();

        // * The save auto-completes and the panel reports success
        await expect(teamSettings.savePanel.messageText).toHaveMessage(Msg.saveChangesPanel.saved);

        // * Team is now private. Privacy is driven by allow_open_invite alone; the
        // feature never mutates team.type, so it stays 'O' from createPublicTeam.
        const updatedTeam = await adminClient.getTeam(team.id);
        expect(updatedTeam.type).toBe('O');
        expect(updatedTeam.allow_open_invite).toBe(false);

        // * A sync job was created
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBeGreaterThan(0);

        await closeTeamSettings(teamSettings);
    });

    test('MM-70055_1 team admin mode-flip modal resolves the member count on a parent-governed team', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # The team admin must match the rule, otherwise self-exclusion blocks the flip
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # A non-qualifying member so the count is non-zero
        const outsider = await adminClient.createUser(
            {
                email: `outsider${suffix}@sample.mattermost.com`,
                username: `outsider${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(outsider.id);
        await adminClient.addToTeam(team.id, outsider.id);
        await setUserAttribute(adminClient, outsider.id, 'Department', 'Marketing');

        // # Govern the team by a parent policy only — no custom rules in Team Settings
        const parent = await createParentMembershipPolicy(
            adminClient,
            `Parent Policy ${suffix}`,
            'user.attributes.Department == "Engineering"',
        );
        createdPolicyIds.push(parent.id);
        await assignTeamToParentPolicy(adminClient, parent.id, team.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openAccessTab(app);

        // # Click the Private card
        await teamSettings.access.discoverability.privateButton.click();

        const modeFlipModal = teamSettings.access.modeFlipModal;
        await expect(modeFlipModal).toContainMessage(Msg.team_settings.mode_flip_confirm.title);
        await expect(modeFlipModal).toBeVisible();

        // * The count resolves from the parent policy instead of falling back to the
        // generic copy, which is all a team admin used to get (MM-70055).
        await expect(modeFlipModal).toContainText(/not meet criteria and will be removed/i);
        await expect(modeFlipModal).not.toContainText(/Some members may not meet/i);

        await modeFlipModal.cancelButton.click();
        await expect(modeFlipModal).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });

    test('MM-70057_1 team admin sees the last-synced timestamp in the sync footer', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');

        // # A policy must exist for the sync footer to render at all
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        // # Run a sync and wait for it to complete, so there is a timestamp to show
        await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/jobs`, {
            method: 'POST',
            body: JSON.stringify({type: 'access_control_team_sync', data: {policy_id: team.id}}),
        });

        await expect
            .poll(
                async () => {
                    const jobs: any[] = await (adminClient as any).doFetch(
                        `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                        {method: 'GET'},
                    );
                    return jobs.some((j: any) => j.data?.policy_id === team.id && j.status === 'success');
                },
                {
                    timeout: duration.half_min,
                    intervals: [500, 1000, 2000, 3000],
                    message: 'the team sync job should complete before checking the footer',
                },
            )
            .toBe(true);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * The footer reports the completed sync. Reading the job list used to be
        // system-admin only, so a team admin always saw "Never synced" (MM-70057).
        const syncFooterText = tab.syncStatus.timeText.locator;
        await expect(syncFooterText).toContainText(/Last synced/i, {timeout: duration.half_min});
        await expect(syncFooterText).not.toContainText(/Never synced/i);

        await closeTeamSettings(teamSettings);
    });

    test('MM-69100_29 team admin existing policy and auto-add state load correctly on tab open', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create teamAdmin before the policy so addToTeam isn't gated by the
        // Engineering rule (teamAdmin has no Department attribute).
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Pre-create policy with auto-add=true via API
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', true);

        // Wait until the server has fully processed the policy (policy_enforced=true).
        // The tab's loadTeamPolicy fetch may hit a read replica; without this the
        // policy arrives as null, autoAddMembers stays false, and the checkbox fails.
        await expect
            .poll(async () => (await adminClient.getTeam(team.id)).policy_enforced, {
                timeout: duration.one_min,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        const app = await openTeam(pw, teamAdmin, team);

        const teamSettings = await openTeamMembershipTab(app);
        const tab = teamSettings.membership;

        // * Auto-add checkbox is checked (auto_add was loaded from the API)
        await expect(tab.autoAddCheckbox).toBeChecked({timeout: duration.half_min});

        // * Table editor is present
        await expect(tab.rules).toBeVisible();

        // * No SaveChangesPanel (nothing dirty after initial load)
        await expect(teamSettings.savePanel.saveButton).not.toBeVisible();

        await closeTeamSettings(teamSettings);
    });
});
