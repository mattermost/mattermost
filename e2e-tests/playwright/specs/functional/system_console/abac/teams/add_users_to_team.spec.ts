// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Add Members to Team modal (System Console) blocks non-qualifying candidates in strict mode
 * @reference MM-69100
 */

import type {Team} from '@mattermost/types/teams';

import {expect, newTestPassword, test, type App, duration, Msg} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createPublicTeam,
    createTeamMembershipPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

import {cleanUpCreated, enableTeamMembershipPolicies} from './helpers';

/** Opens System Console > Teams > the team's page and its Add Members dialog. */
async function openAddMembers(app: App, team: Team) {
    await app.page.goto(`/admin_console/user_management/teams/${team.id}`);
    const modal = await app.admin.team.addMembersButton.clickTo(app.addUsersToTeamModal);
    await expect(modal).toBeVisible();
    await expect(modal.users.searchCombobox).toBeVisible();
    return modal.users;
}

test.describe('ABAC - Add members to team (System Console)', {tag: ['@abac', '@team_membership']}, () => {
    test.setTimeout(duration.two_min);

    const createdTeamIds: string[] = [];
    const createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        await cleanUpCreated(adminClient, {teamIds: createdTeamIds.splice(0), userIds: createdUserIds.splice(0)});
    });

    test('MM-68846-T7 PRIVATE governed team blocks non-qualifying candidates inline', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create private team with Engineering policy
        const team = await createPrivateTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Create eng1 (Engineering) and mkt1 (Marketing) — not added to team yet
        const createUser = async (dept: string, label: string) => {
            const uid = `${suffix}${label}`;
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    first_name: dept,
                    last_name: label,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createUser('Engineering', `eng1${suffix}`);
        const mkt1 = await createUser('Marketing', `mkt1${suffix}`);
        createdUserIds.push(eng1.id, mkt1.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        // # Log in as system admin and open the team's Add Members dialog
        const {app} = await pw.testBrowser.login(adminUser);
        const users = await openAddMembers(app, team);

        // # Search for eng1 — qualifying candidate
        await users.searchCombobox.type(eng1.username.slice(0, 8));
        const eng1Row = users.results.user(eng1);
        await expect(eng1Row).toBeVisible();

        // * eng1's row is NOT disabled
        await expect(eng1Row).toHaveAttribute('aria-disabled', 'false');
        await expect(eng1Row.deniedText).toHaveCount(0);

        // # Search for mkt1 — non-qualifying candidate
        await users.searchCombobox.clear();
        await expect(users.searchCombobox).toHaveValue('');
        await users.searchCombobox.type(mkt1.username.slice(0, 8));
        const mkt1Row = users.results.user(mkt1);
        await expect(mkt1Row).toBeVisible();

        // * mkt1's row is disabled with the blocking message
        await expect(mkt1Row).toHaveAttribute('aria-disabled', 'true');
        await expect(mkt1Row.deniedText).toHaveMessage(Msg.add_users_to_team.policy_denied);
    });

    test('MM-68846-T8 PUBLIC governed team does NOT block candidates (advisory)', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Admin user not found');
        }
        const suffix = pw.random.id();
        await enableTeamMembershipABACConfig(adminClient);
        await enableTeamMembershipPolicies(adminClient);
        await ensureDepartmentAttribute(adminClient);

        // # Create public team with Engineering policy
        const team = await createPublicTeam(adminClient, suffix);
        createdTeamIds.push(team.id);

        // # Create eng1 and mkt1
        const createUser = async (dept: string, label: string) => {
            const uid = `${suffix}${label}`;
            const user = await adminClient.createUser(
                {
                    email: `${uid}@sample.mattermost.com`,
                    username: uid,
                    first_name: dept,
                    last_name: label,
                    password: newTestPassword(),
                } as any,
                '',
                '',
            );
            await setUserAttribute(adminClient, user.id, 'Department', dept);
            return user;
        };

        const eng1 = await createUser('Engineering', `eng1${suffix}`);
        const mkt1 = await createUser('Marketing', `mkt1${suffix}`);
        createdUserIds.push(eng1.id, mkt1.id);

        await waitForAttributeViewToInclude(adminClient, 'user.attributes.Department == "Engineering"', [eng1.id]);

        // # Advisory policy (public team)
        await createTeamMembershipPolicy(adminClient, team.id, 'user.attributes.Department == "Engineering"', false);

        // # Log in as system admin and open the team's Add Members dialog
        const {app} = await pw.testBrowser.login(adminUser);
        const users = await openAddMembers(app, team);

        // # Search for mkt1 — non-qualifying but advisory = no block
        await users.searchCombobox.type(mkt1.username.slice(0, 8));
        const mkt1Row = users.results.user(mkt1);
        await expect(mkt1Row).toBeVisible();

        // * Row is NOT disabled
        await expect(mkt1Row).toHaveAttribute('aria-disabled', 'false');
        await expect(mkt1Row.deniedText).toHaveCount(0);
    });
});
