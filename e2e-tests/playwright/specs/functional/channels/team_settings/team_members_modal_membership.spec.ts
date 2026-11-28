// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Team Members modal shows membership requirements banner and attribute chips for governed teams
 * @reference MM-69100
 */

import {expect, ignoreMissing, Msg, newTestPassword, test, type App, duration} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPublicTeam,
    createTeamMembershipPolicy,
    createTeamAdmin,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from './helpers';

/** Opens the Team Members modal from the team menu and waits for it. */
async function openTeamMembers(app: App) {
    await app.lhs.header.openTeamMenuButton.clickTo(app.lhs.teamMenu);
    await app.lhs.teamMenu.membersMenuItem.click();
    const modal = app.teamMembersModal;
    await expect(modal).toBeVisible();
    return modal;
}

test.describe('Team Members Modal - Membership Policy Banner', {tag: ['@abac', '@team_membership']}, () => {
    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds.splice(0)) {
            await ignoreMissing(() => adminClient.deleteTeam(id));
        }
        for (const id of createdUserIds.splice(0)) {
            await ignoreMissing(() => adminClient.updateUserActive(id, false));
        }
    });

    test('MM-69100_34 governed team shows the policy banner in the Team Members modal', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team, townSquare} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Members modal from the team menu (Manage members for admins, View members otherwise)
        const modal = await openTeamMembers(app);
        const banner = modal.policyBanner;

        // * Banner present with correct title and description
        await expect(banner).toContainMessage(Msg.team_member_modal.policy_enforced.title);
        await expect(banner).toBeVisible();
        await expect(banner).toContainMessage(Msg.team_member_modal.policy_enforced.description);
        await expect(banner).toContainText('Team access is restricted by user attributes');
        await expect(banner).toContainText(
            'Only people who meet the membership requirements can be members of this team.',
        );
    });

    test('MM-69100_35 attribute holder sees attribute chips inside the policy banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team, townSquare} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create team admin who is an attribute holder (Engineering)
        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);
        await setUserAttribute(adminClient, teamAdmin.id, 'Department', 'Engineering');
        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [teamAdmin.id]);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Members modal from the team menu (Manage members for admins, View members otherwise)
        const modal = await openTeamMembers(app);
        const banner = modal.policyBanner;

        // * Banner visible
        await expect(banner).toBeVisible();

        // * Attribute chip "Department: Engineering" visible (async — chip text loads after banner)
        await expect(banner).toContainText(/Department: Engineering/i, {timeout: duration.half_min});
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

        const {app} = await pw.testBrowser.login(regularUser);
        await app.channelsPage.goto({team, channel: 'town-square'});

        // # Open Team Members modal from the team menu (Manage members for admins, View members otherwise)
        const modal = await openTeamMembers(app);
        const banner = modal.policyBanner;

        // * Banner present with softened advisory copy (public team)
        await expect(banner).toContainMessage(Msg.team_member_modal.policy_advisory.title);
        await expect(banner).toBeVisible();
        await expect(banner).toContainMessage(Msg.team_member_modal.policy_advisory.description);
        await expect(banner).toContainText('This team has membership requirements');
        await expect(banner).toContainText(/can still join, but will not be automatically added/i);
        await expect(banner).not.toContainText('Team access is restricted by user attributes');
        await expect(banner).not.toContainMessage(Msg.team_member_modal.policy_enforced.title);
    });

    test('MM-69100_37 ungoverned team does not show the policy banner in Team Members modal', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, team, townSquare} = await pw.initSetup();
        await enableTeamMembershipABACConfig(adminClient);

        const teamAdmin = await createTeamAdmin(adminClient, team.id);
        createdUserIds.push(teamAdmin.id);

        const {app} = await pw.testBrowser.login(teamAdmin);
        await app.channelsPage.goto({team, channel: townSquare});

        // # Open Team Members modal from the team menu (Manage members for admins, View members otherwise)
        const modal = await openTeamMembers(app);
        const banner = modal.policyBanner;

        // * No policy banner for ungoverned team (the governed tests above see it), while the member list loads
        await expect(modal.members.searchTextbox).toBeVisible();
        await expect(banner).not.toBeVisible();
    });
});
