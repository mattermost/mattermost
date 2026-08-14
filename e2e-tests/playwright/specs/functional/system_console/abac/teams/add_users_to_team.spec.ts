// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @objective Add Members to Team modal (System Console) blocks non-qualifying candidates in strict mode
 * @reference MM-69100
 */

import {expect, newTestPassword, test} from '@mattermost/playwright-lib';

import {
    enableTeamMembershipABACConfig,
    ensureDepartmentAttribute,
    createPrivateTeam,
    createPublicTeam,
    createTeamMembershipPolicy,
    setUserAttribute,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';

import {enableTeamMembershipPolicies} from './helpers';

test.describe('ABAC - Add members to team (System Console)', {tag: ['@abac', '@team_membership']}, () => {
    test.setTimeout(120000);

    let createdTeamIds: string[] = [];
    let createdUserIds: string[] = [];

    test.afterEach(async ({pw}) => {
        const {adminClient} = await pw.getAdminClient();
        for (const id of createdTeamIds) {
            try {
                await adminClient.deleteTeam(id);
            } catch {
                // ignore
            }
        }
        createdTeamIds = [];
        for (const id of createdUserIds) {
            try {
                await adminClient.updateUserActive(id, false);
            } catch {
                // ignore
            }
        }
        createdUserIds = [];
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

        // # Log in as system admin and navigate to the per-team console page
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        await page.goto(`/admin_console/user_management/teams/${team.id}`);

        // # Click "Add Members" button
        await page.locator('#addTeamMembers').click();

        const addModal = page.locator('#addUsersToTeamModal');
        await expect(addModal).toBeVisible({timeout: 10000});

        // MultiSelect uses React-Select which renders the input as a combobox role, not
        // a plain <input placeholder="...">.  Use getByRole to match the accessible name.
        const searchInput = addModal.getByRole('combobox', {name: 'Search for people'});
        await expect(searchInput).toBeVisible({timeout: 10000});

        // # Search for eng1 — qualifying candidate
        await searchInput.pressSequentially(eng1.username.slice(0, 8));
        const eng1Row = addModal.locator('.more-modal__row', {hasText: eng1.username});
        await expect(eng1Row).toBeVisible({timeout: 10000});

        // * eng1's row is NOT disabled
        await expect(eng1Row).not.toHaveClass(/more-modal__row--disabled/);
        await expect(eng1Row.locator('.more-modal__error')).not.toBeVisible();

        // # Search for mkt1 — non-qualifying candidate
        await searchInput.clear();
        await searchInput.pressSequentially(mkt1.username.slice(0, 8));
        const mkt1Row = addModal.locator('.more-modal__row', {hasText: mkt1.username});
        await expect(mkt1Row).toBeVisible({timeout: 10000});

        // * mkt1's row is disabled with the blocking message
        await expect(mkt1Row).toHaveClass(/more-modal__row--disabled/);
        await expect(mkt1Row.locator('.more-modal__error')).toHaveText('Does not meet membership requirements');
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

        // # Log in as system admin
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        await page.goto(`/admin_console/user_management/teams/${team.id}`);

        // # Click "Add Members" button
        await page.locator('#addTeamMembers').click();

        const addModal = page.locator('#addUsersToTeamModal');
        await expect(addModal).toBeVisible({timeout: 10000});

        const searchInput = addModal.getByRole('combobox', {name: 'Search for people'});
        await expect(searchInput).toBeVisible({timeout: 10000});

        // # Search for mkt1 — non-qualifying but advisory = no block
        await searchInput.pressSequentially(mkt1.username.slice(0, 8));
        const mkt1Row = addModal.locator('.more-modal__row', {hasText: mkt1.username});
        await expect(mkt1Row).toBeVisible({timeout: 10000});

        // * Row is NOT disabled
        await expect(mkt1Row).not.toHaveClass(/more-modal__row--disabled/);
        await expect(mkt1Row.locator('.more-modal__error')).not.toBeVisible();
    });
});
