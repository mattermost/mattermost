// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Team Members modal shows membership requirements banner and attribute chips for governed teams
 * @reference MM-69100
 */

import {ChannelsPage, expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from './helpers';

test.describe('Team Members Modal - Membership Policy Banner', {tag: ['@abac', '@team_membership']}, () => {
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

    test('MM-69100_34 governed team shows the policy banner in the Team Members modal', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Team Members modal via sidebar menu
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickManageMembers();

        const modal = page.locator('#teamMembersModal');
        await expect(modal).toBeVisible({timeout: 10000});

        // * Banner present with correct title and description
        const banner = modal.locator('.teamMembersModal__policyBanner');
        await expect(banner).toBeVisible({timeout: 10000});
        await expect(banner.getByText('Team access is restricted by user attributes')).toBeVisible();
        await expect(
            banner.getByText('Only people who meet the membership requirements can be members of this team.'),
        ).toBeVisible();
    });

    test('MM-69100_35 attribute holder sees attribute chips inside the policy banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create team admin who is an attribute holder (Engineering)
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Team Members modal
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickManageMembers();

        const modal = page.locator('#teamMembersModal');
        await expect(modal).toBeVisible({timeout: 10000});

        // * Banner visible
        await expect(modal.locator('.teamMembersModal__policyBanner')).toBeVisible({timeout: 10000});

        // * Attribute chip "Department: Engineering" visible (async — chip text loads after banner)
        await expect(modal.getByText(/Department: Engineering/i)).toBeVisible({timeout: 15000});
    });

    test('MM-69100_36 non-admin team member sees the policy banner in the Team Members modal', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient} = await pw.getAdminClient();
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Public team with Engineering policy
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Regular user (non-admin) — verifies the banner appears for ordinary members too
        const regularUser = await adminClient.createUser(
            {
                email: `regular${suffix}@sample.mattermost.com`,
                username: `regular${suffix}`,
                password: newTestPassword(),
            } as any,
            '',
            '',
        );
        createdUserIds.push(regularUser.id);
        regularUser.password = newTestPassword();
        await adminClient.savePreferences(regularUser.id, [
            {user_id: regularUser.id, category: 'tutorial_step', name: regularUser.id, value: '999'},
            {user_id: regularUser.id, category: 'onboarding', name: 'complete', value: 'true'},
            {
                user_id: regularUser.id,
                category: 'onboarding_task_list',
                name: 'onboarding_task_list_show',
                value: 'false',
            },
            {
                user_id: regularUser.id,
                category: 'onboarding_task_list',
                name: 'onboarding_task_list_open',
                value: 'false',
            },
        ]);
        await adminClient.addToTeam(team.id, regularUser.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const {page} = await pw.testBrowser.login(regularUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Team Members modal (regular user sees "View members")
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.container.getByRole('menuitem', {name: /View members|Manage members/i}).click();

        const modal = page.locator('#teamMembersModal');
        await expect(modal).toBeVisible({timeout: 10000});

        // * Banner present
        await expect(modal.locator('.teamMembersModal__policyBanner')).toBeVisible({timeout: 10000});
    });

    test('MM-69100_37 ungoverned team does not show the policy banner in Team Members modal', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Open Team Members modal
        await channelsPage.sidebarLeft.teamMenuButton.click();
        await channelsPage.teamMenu.toBeVisible();
        await channelsPage.teamMenu.clickManageMembers();

        const modal = page.locator('#teamMembersModal');
        await expect(modal).toBeVisible({timeout: 10000});

        // * No policy banner for ungoverned team
        await expect(modal.locator('.teamMembersModal__policyBanner')).not.toBeVisible({timeout: 5000});
    });
});
