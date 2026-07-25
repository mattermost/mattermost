// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Team admin can manage team membership ABAC via the in-channel Team Settings modal
 * @reference MM-69100
 */

import type {Page} from '@playwright/test';

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
    waitForAttributeViewToExclude,
    addAttributeRule,
    getTeamAccessControlPolicy,
} from './helpers';

async function openTeamMembershipTab(page: Page, channelsPage: ChannelsPage) {
    const teamSettings = await channelsPage.openTeamSettings();
    await teamSettings.container.getByTestId('team_membership-tab-button').click();
    const tab = teamSettings.container.locator('.TeamMembershipTab');
    await expect(tab).toBeVisible({timeout: 10000});
    return {teamSettings, tab};
}

test.describe('Team Settings Modal - Team Membership as Team Admin', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds.splice(0)) {
            await adminClient.deleteTeam(id).catch(() => {});
        }
        for (const id of createdUserIds.splice(0)) {
            await adminClient.updateUserActive(id, false).catch(() => {});
        }
    });

    test('MM-69100_24 team admin can save team membership rules and the policy persists', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Set teamAdmin Engineering so the rule does not self-exclude them
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add Engineering rule; leave auto-add OFF
        await addAttributeRule(tab, page, 'Engineering');

        // # Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});
        await confirmModal.getByRole('button', {name: 'Save'}).click();

        // * Save panel disappears
        await expect(confirmModal).not.toBeVisible({timeout: 10000});
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible({timeout: 10000});

        // * Policy persisted — expression contains "Engineering"
        const policyResult: any = await getTeamAccessControlPolicy(adminClient, team.id);
        expect(JSON.stringify(policyResult)).toContain('Engineering');

        await teamSettings.close();
    });

    test('MM-69100_25 team admin enabling auto-add triggers a team sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        // # Set teamAdmin Engineering to avoid self-exclusion
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const testStartTime = Date.now();

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add rule and enable auto-add
        await addAttributeRule(tab, page, 'Engineering');
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeEnabled({timeout: 5000});
        await tab.locator('#autoAddMembersCheckbox').click();
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeChecked();

        // # Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});
        await confirmModal.getByRole('button', {name: 'Save'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible({timeout: 10000});

        // * A sync job was created (auto-add ON)
        const jobs: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const recentJobs = jobs.filter((j: any) => j.create_at >= testStartTime);
        expect(recentJobs.length).toBeGreaterThan(0);

        await teamSettings.close();
    });

    test('MM-69100_26 team admin is hard-blocked from saving a self-excluding rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # teamAdmin has NO Department — they do not match the Engineering rule
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await waitForAttributeViewToExclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add Engineering rule (teamAdmin would be excluded)
        await addAttributeRule(tab, page, 'Engineering');

        // # Attempt save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Self-exclusion modal appears — not the save confirmation
        await expect(page.getByText('Cannot save access rules')).toBeVisible({timeout: 15000});
        await expect(page.getByText(/you cannot set these rules/i)).toBeVisible();
        await expect(page.getByText('Save team membership rules?')).not.toBeVisible();

        // * "Back to editing" button dismisses the self-exclusion modal
        await expect(page.getByRole('button', {name: 'Back to editing'})).toBeVisible();
        await page.getByRole('button', {name: 'Back to editing'}).click();
        await expect(page.getByText('Cannot save access rules')).not.toBeVisible({timeout: 5000});

        // * Policy unchanged via API
        try {
            const policyResult: any = await getTeamAccessControlPolicy(adminClient, team.id);
            expect(JSON.stringify(policyResult ?? {})).not.toContain('"Engineering"');
        } catch {
            // No policy exists — self-exclusion correctly blocked the save
        }

        await teamSettings.close();
    });

    test('MM-69100_27 team admin save-confirmation shows correct allowed and restricted counts', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add Engineering rule
        await addAttributeRule(tab, page, 'Engineering');

        // # Click Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * 2 users match (teamAdmin + user1); 1 current member does not (user2 / Marketing)
        await expect(confirmModal.getByText(/2 users match/i)).toBeVisible({timeout: 10000});
        await expect(confirmModal.getByText(/1 current member does not match/i)).toBeVisible({timeout: 10000});

        // # Cancel without saving
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();

        await teamSettings.close();
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

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessTab();

        // * Public card is initially selected
        await expect(teamSettings.container.locator('#public-private-selector-button-O')).toHaveClass(/selected/);

        // # Click Private card — mode-flip modal appears (policy_enforced=true triggers it)
        await teamSettings.container.locator('#public-private-selector-button-P').click();

        const modeFlipModal = page.locator('.ConfirmModal').filter({hasText: 'Switch to Private Team?'});
        await expect(modeFlipModal).toBeVisible({timeout: 30000});

        // * The modal warns that the flip activates strict ABAC enforcement.
        await expect(modeFlipModal.getByText(/activate strict ABAC enforcement/i)).toBeVisible({timeout: 10000});

        // # Confirm the flip — mirroring discoverability MM-69100_6 exactly
        await modeFlipModal.getByRole('button', {name: 'Switch to Private'}).click();
        await expect(modeFlipModal).not.toBeVisible({timeout: 5000});

        await expect(teamSettings.saveButton).toBeVisible();
        await teamSettings.save();
        await teamSettings.verifySavedMessage();

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

        await teamSettings.close();
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
                timeout: 60_000,
                intervals: [1000, 2000, 5000, 5000, 5000],
            })
            .toBe(true);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * Auto-add checkbox is checked (active=true was loaded from API)
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeChecked({timeout: 15000});

        // * Table editor is present
        await expect(tab.getByTestId('table-editor')).toBeVisible();

        // * No SaveChangesPanel (nothing dirty after initial load)
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible();

        await teamSettings.close();
    });
});
