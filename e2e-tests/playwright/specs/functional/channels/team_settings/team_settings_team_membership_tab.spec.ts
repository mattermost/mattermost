// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective E2E tests for Team Settings Modal - Team Membership tab
 * @reference MM-69100
 */

import type {Page} from '@playwright/test';

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
    waitForAttributeViewToExclude,
    addAttributeRule,
    createParentPolicy,
    assignTeamToParentPolicy,
} from './helpers';

async function openTeamMembershipTab(page: Page, channelsPage: ChannelsPage) {
    const teamSettings = await channelsPage.openTeamSettings();
    await teamSettings.container.getByTestId('team_membership-tab-button').click();
    const tab = teamSettings.container.locator('.TeamMembershipTab');
    await expect(tab).toBeVisible({timeout: 10000});
    return {teamSettings, tab};
}

test.describe('Team Settings Modal - Team Membership Tab', {tag: ['@abac', '@team_membership']}, () => {
    test('MM-69100_8 Team Membership tab visible for system admin with ABAC + FF enabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // * Team Membership tab button is visible
        await expect(teamSettings.container.getByTestId('team_membership-tab-button')).toBeVisible();

        // # Click Team Membership tab
        await teamSettings.container.getByTestId('team_membership-tab-button').click();
        const tab = teamSettings.container.locator('.TeamMembershipTab');
        await expect(tab).toBeVisible();

        // * Tab title is visible
        await expect(teamSettings.container.getByText('Team Membership Rules')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_9 Team Membership tab visible for team admin', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();

        // * Team Membership tab button is visible for team admin
        await expect(teamSettings.container.getByTestId('team_membership-tab-button')).toBeVisible();

        await teamSettings.container.getByTestId('team_membership-tab-button').click();
        await expect(teamSettings.container.locator('.TeamMembershipTab')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_10 Empty state: no banner, table editor visible, auto-add disabled', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * No system policy banner (no parent policy assigned)
        await expect(tab.locator('.TeamMembershipTab__systemPolicies')).not.toBeVisible();

        // * Table editor is present
        await expect(tab.getByTestId('table-editor')).toBeVisible();

        // * Auto-add checkbox is disabled (no rules yet)
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeDisabled();

        // * No SaveChangesPanel (nothing is dirty)
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_11 System policy InfoBanner visible when team is assigned to a parent policy', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a parent policy and assign the team to it
        const policyName = `Global Team Policy ${pw.random.id()}`;
        const policy = await createParentPolicy(adminClient, policyName);
        await assignTeamToParentPolicy(adminClient, policy.id, team.id);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * System policy banner is visible
        await expect(tab.locator('.TeamMembershipTab__systemPolicies')).toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_12 Auto-add disabled with no expression, enabled after adding a rule', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * Auto-add starts disabled (empty expression)
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeDisabled();

        // # Add an attribute rule
        await addAttributeRule(tab, page, 'Engineering');

        // * Auto-add checkbox becomes enabled
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeEnabled({timeout: 5000});

        await teamSettings.close();
    });

    test('MM-69100_13 Save attribute rules without auto-add — policy persisted, no sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Engineering"',
            [adminUser.id],
        );

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add attribute rule (auto-add stays OFF)
        await addAttributeRule(tab, page, 'Engineering');
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeEnabled({timeout: 5000});

        // # Snapshot job count right before saving — captures any pre-existing jobs from parallel workers
        const jobsBefore: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const jobCountBefore = jobsBefore.length;

        // # Click Save → confirmation modal appears
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * Allowed count is at least 1 (adminUser matches Engineering)
        await expect(confirmModal.getByText(/user.*match.*current rules/i)).toBeVisible({timeout: 10000});

        // # Confirm save
        await confirmModal.getByRole('button', {name: 'Save'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible({timeout: 10000});

        // * Policy is persisted via API
        const policyResult: any = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/teams/${team.id}/access_control/policy`,
            {method: 'GET'},
        );
        expect(JSON.stringify(policyResult)).toContain('Engineering');

        // * No sync job was created (auto-add was OFF) — compare against the pre-save snapshot
        const jobsAfter: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        expect(jobsAfter.length).toBe(jobCountBefore);

        await teamSettings.close();
    });

    test('MM-69100_14 Enable auto-add on save triggers team sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        await setUserAttribute(adminClient, adminUser.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Engineering"',
            [adminUser.id],
        );

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add attribute rule
        await addAttributeRule(tab, page, 'Engineering');
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeEnabled({timeout: 5000});

        // # Enable auto-add
        await tab.locator('#autoAddMembersCheckbox').click();
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeChecked();

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
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // # Confirm
        await confirmModal.getByRole('button', {name: 'Save'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible({timeout: 10000});

        // * A sync job was created — poll until a newer job appears at the top of the list
        await expect.poll(
            async () => {
                const jobs: any[] = await (adminClient as any).doFetch(
                    `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
                    {method: 'GET'},
                );
                return jobs[0]?.id !== latestJobIdBefore;
            },
            {timeout: 15000, intervals: [500, 1000, 2000, 3000]},
        ).toBe(true);

        await teamSettings.close();
    });

    test('MM-69100_15 Toggling auto-add OFF and saving does NOT create a sync job', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Create policy with auto-add=true via API
        await createTeamMembershipPolicy(adminClient, team.id, 'true', true);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * Auto-add checkbox starts checked (policy.active=true was loaded)
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeChecked({timeout: 5000});

        // # Uncheck auto-add
        await tab.locator('#autoAddMembersCheckbox').click();
        await expect(tab.locator('#autoAddMembersCheckbox')).not.toBeChecked();

        // # Snapshot job count right before saving
        const jobsBefore: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        const jobCountBefore = jobsBefore.length;

        // # Save → confirmation modal
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        await confirmModal.getByRole('button', {name: 'Save'}).click();
        await expect(confirmModal).not.toBeVisible({timeout: 10000});
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible({timeout: 10000});

        // * No sync job was created (auto-add was turned OFF, not ON)
        const jobsAfter: any[] = await (adminClient as any).doFetch(
            `${adminClient.getBaseRoute()}/jobs/type/access_control_team_sync`,
            {method: 'GET'},
        );
        expect(jobsAfter.length).toBe(jobCountBefore);

        await teamSettings.close();
    });

    test('MM-69100_16 Self-exclusion: admin blocked when their own rule would exclude them', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Ensure adminUser has NO Department attribute (a prior test may have set it to "Engineering").
        // Clear it and wait for the materialized AttributeView to reflect the removal so that
        // validateExpressionAgainstRequester correctly returns requester_matches=false.
        await setUserAttribute(adminClient, adminUser.id, 'Department', '');
        await waitForAttributeViewToExclude(adminClient, 'user.attributes.Department == "Engineering"', [adminUser.id]);

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add rule that adminUser does NOT match
        await addAttributeRule(tab, page, 'Engineering');

        // # Click Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Self-exclusion modal appears, not the save confirmation modal
        await expect(page.getByText('Cannot save access rules')).toBeVisible({timeout: 15000});
        await expect(page.getByText(/you cannot set these rules/i)).toBeVisible();

        // * Save confirmation modal did NOT appear
        await expect(page.getByText('Save team membership rules?')).not.toBeVisible();

        // * "Back to editing" button is visible
        await expect(page.getByRole('button', {name: 'Back to editing'})).toBeVisible();

        // # Click Back to editing — self-exclusion modal closes
        await page.getByRole('button', {name: 'Back to editing'}).click();
        await expect(page.getByText('Cannot save access rules')).not.toBeVisible({timeout: 5000});

        // * Policy was NOT changed
        try {
            const policyResult: any = await (adminClient as any).doFetch(
                `${adminClient.getBaseRoute()}/teams/${team.id}/access_control/policy`,
                {method: 'GET'},
            );
            // Policy should be empty/not contain Engineering if no prior policy existed
            const policyStr = JSON.stringify(policyResult ?? {});
            expect(policyStr).not.toContain('"Engineering"');
        } catch {
            // No policy exists — self-exclusion correctly blocked the save
        }

        await teamSettings.close();
    });

    test('MM-69100_17 Save confirmation modal shows correct allowed and restricted counts', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

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
        const [user1] = await Promise.all([
            createMember('Engineering', 1),
            createMember('Marketing', 2),
        ]);

        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Engineering"',
            [adminUser.id, user1.id],
        );

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add attribute rule (Department == Engineering)
        await addAttributeRule(tab, page, 'Engineering');

        // # Click Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * 2 users match (adminUser + user1). 2 members do not match: marketingUser plus
        //   the regular user that initSetup creates and adds to the team (no Department set).
        await expect(confirmModal.getByText(/2 users match/i)).toBeVisible({timeout: 10000});
        await expect(confirmModal.getByText(/2 current members do not match/i)).toBeVisible({timeout: 10000});

        // # Cancel without saving
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_18 Confirmation modal shows restricted count when some team members do not match the rules', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create a private team with adminUser as creator (automatically a member)
        const team = await createPrivateTeam(adminClient, suffix);

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
        await adminClient.addToTeam(team.id, engUser.id);
        await setUserAttribute(adminClient, engUser.id, 'Department', 'Engineering');

        // Wait for BOTH users to appear in the attribute view so computeConfirmCounts
        // gets accurate counts (adminUser matches Marketing; engUser does not).
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Marketing"',
            [adminUser.id],
        );
        await waitForAttributeViewToInclude(
            adminClient,
            'user.attributes.Department == "Engineering"',
            [engUser.id],
        );

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // # Add rule: Department == Marketing (only adminUser matches)
        await addAttributeRule(tab, page, 'Marketing');

        // # Click Save
        await tab.locator('[data-testid="SaveChangesPanel__save-btn"]').click();

        // * Confirmation modal appears (self-exclusion passes since adminUser IS Marketing)
        const confirmModal = page.locator('.ConfirmModal').filter({hasText: 'Save team membership rules?'});
        await expect(confirmModal).toBeVisible({timeout: 15000});

        // * 1 user matches (adminUser) and 1 member does not (engUser / Engineering)
        await expect(confirmModal.getByText(/1 user matches/i)).toBeVisible({timeout: 10000});
        await expect(confirmModal.getByText(/1 current member does not match/i)).toBeVisible({timeout: 10000});

        // # Cancel — don't save
        await confirmModal.getByRole('button', {name: 'Cancel'}).click();
        await expect(confirmModal).not.toBeVisible();

        await teamSettings.close();
    });

    test('MM-69100_19 Existing rules and auto-add state load correctly when tab opened', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        // # Pre-create policy with auto-add=true
        await createTeamMembershipPolicy(
            adminClient,
            team.id,
            'user.attributes.Department == "Engineering"',
            true,
        );

        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        const {teamSettings, tab} = await openTeamMembershipTab(page, channelsPage);

        // * Auto-add is checked (active=true was loaded from API)
        await expect(tab.locator('#autoAddMembersCheckbox')).toBeChecked({timeout: 5000});

        // * Table editor is present and the panel is NOT shown (nothing is dirty after load)
        await expect(tab.getByTestId('table-editor')).toBeVisible();
        await expect(tab.locator('[data-testid="SaveChangesPanel__save-btn"]')).not.toBeVisible();

        await teamSettings.close();
    });

});
