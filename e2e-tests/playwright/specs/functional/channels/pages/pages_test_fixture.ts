// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Client4} from '@mattermost/client';

import {test as base, expect} from '@mattermost/playwright-lib';

/**
 * Worker-scoped fixtures: shared across all tests in a worker.
 * Contains team and admin setup.
 */
type PagesWorkerFixtures = {
    pagesWorkerSetup: {
        team: Team;
        adminUser: UserProfile;
        adminClient: Client4;
    };
};

/**
 * Test-scoped fixtures: provided to each test.
 */
type PagesTestFixtures = {
    sharedPagesSetup: {
        team: Team;
        user: UserProfile;
        adminClient: Client4;
    };
};

/**
 * Extended test fixture for pages tests.
 *
 * Uses the ADMIN USER for most tests to bypass HA role cache sync issues.
 * Admin users have PermissionManageSystem which bypasses all role-based
 * permission checks in SessionHasPermissionToChannel (see authorization.go:112).
 *
 * This avoids the fundamental HA sync problem:
 * - Role cache invalidation uses ClusterSendBestEffort (unreliable)
 * - Browser requests can hit any HA node via load balancer
 * - Some nodes may have stale role cache indefinitely
 *
 * For permission-specific tests, use the separate `testWithRegularUser` fixture
 * exported from this file.
 */
export const test = base.extend<PagesTestFixtures, PagesWorkerFixtures>({
    // Worker-scoped fixture: team and admin setup
    pagesWorkerSetup: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const {getAdminClient, createRandomTeam, getOnPremServerConfig} =
                await import('@mattermost/playwright-lib');

            // Login admin
            const {adminClient, adminUser} = await getAdminClient();

            // Reset server config with explicit TeammateNameDisplay setting
            // to ensure usernames are displayed in tests
            const config = getOnPremServerConfig() as any;
            config.TeamSettings.TeammateNameDisplay = 'username';
            config.TeamSettings.LockTeammateNameDisplay = false;
            await adminClient.updateConfig(config);

            // Create shared team for all pages tests in this worker
            const team = await adminClient.createTeam(await createRandomTeam('pages-team', 'Pages Team'));

            await use({team, adminUser: adminUser!, adminClient});
        },
        {scope: 'worker', timeout: 120000},
    ],

    // Test-scoped fixture: creates a fresh admin user for each test
    // Using admin bypasses all role-based permission checks,
    // avoiding HA cluster sync issues entirely.
    // Each test gets a dedicated user to avoid relying on shared sysadmin state.
    sharedPagesSetup: async ({pagesWorkerSetup}, use) => {
        const {team, adminClient} = pagesWorkerSetup;
        const {createRandomUser, makeClient} = await import('@mattermost/playwright-lib');

        // Create a new system admin user for this test
        const randomUser = await createRandomUser('pages-admin');
        const user = await adminClient.createUser(randomUser, '', '');
        user.password = randomUser.password;

        // Make the user a system admin
        await adminClient.updateUserRoles(user.id, 'system_user system_admin');

        // Add user to the team
        await adminClient.addToTeam(team.id, user.id);

        // Set user preferences (skip tutorial, show username as display name)
        const {client: userClient} = await makeClient(user);
        const preferences = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'display_settings', name: 'name_format', value: 'username'},
        ];
        await userClient.savePreferences(user.id, preferences);

        await use({team, user, adminClient});
    },
});

/**
 * Required permissions for wiki/page operations.
 * These need to be added to the channel_user role for permission tests to work.
 */
export const WIKI_PAGE_PERMISSIONS = [
    'manage_public_channel_properties',
    'manage_private_channel_properties',
    'create_page',
    'read_page',
    'edit_page',
    'delete_own_page',
    'delete_page',
];

/**
 * Worker-scoped fixtures for permission tests.
 */
type PermissionsWorkerFixtures = {
    permissionsWorkerSetup: {
        team: Team;
        adminClient: Client4;
    };
};

/**
 * Test-scoped fixtures for permission tests.
 */
type PermissionsTestFixtures = {
    sharedPagesSetup: {
        team: Team;
        user: UserProfile;
        adminClient: Client4;
    };
};

/**
 * Extended test fixture for PERMISSION-SPECIFIC tests.
 *
 * Uses REGULAR USERS to properly test the permission system.
 * Includes longer delays to account for HA role cache sync issues.
 *
 * Use this fixture ONLY in pages_permissions.spec.ts
 */
export const testWithRegularUser = base.extend<PermissionsTestFixtures, PermissionsWorkerFixtures>({
    // Worker-scoped fixture: team and permission setup
    permissionsWorkerSetup: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const {getAdminClient, createRandomTeam, getOnPremServerConfig} =
                await import('@mattermost/playwright-lib');

            // Login admin
            const {adminClient} = await getAdminClient();

            // Reset server config with explicit TeammateNameDisplay setting
            // to ensure usernames are displayed in tests
            const config = getOnPremServerConfig() as any;
            config.TeamSettings.TeammateNameDisplay = 'username';
            config.TeamSettings.LockTeammateNameDisplay = false;
            await adminClient.updateConfig(config);

            // Ensure wiki/page permissions are in channel_user role.
            // We ALWAYS patch the role to trigger cache invalidation across all HA nodes.
            const channelUserRole = await adminClient.getRoleByName('channel_user');
            const allPermissions = new Set([...channelUserRole.permissions, ...WIKI_PAGE_PERMISSIONS]);

            await adminClient.patchRole(channelUserRole.id, {
                permissions: Array.from(allPermissions),
            });

            // Wait for HA cluster nodes to sync role cache.
            // Using 30 seconds as a balance between reliability and test speed.
            // Permission tests may still be flaky in HA environments due to
            // ClusterSendBestEffort delivery semantics.
            const HA_SYNC_DELAY_MS = 30000;
            await new Promise((resolve) => setTimeout(resolve, HA_SYNC_DELAY_MS));

            // Create shared team for all permission tests in this worker
            const team = await adminClient.createTeam(
                await createRandomTeam('pages-perm-team', 'Pages Permission Team'),
            );

            await use({team, adminClient});
        },
        {scope: 'worker', timeout: 180000},
    ],

    // Test-scoped fixture: creates a fresh regular user for each test
    sharedPagesSetup: async ({permissionsWorkerSetup}, use) => {
        const {team, adminClient} = permissionsWorkerSetup;
        const {createRandomUser, makeClient} = await import('@mattermost/playwright-lib');

        // Create a new regular user for this test
        const randomUser = await createRandomUser('pages-user');
        const user = await adminClient.createUser(randomUser, '', '');
        user.password = randomUser.password;
        await adminClient.addToTeam(team.id, user.id);

        // Set user preferences (skip tutorial)
        const {client: userClient} = await makeClient(user);
        const preferences = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
        ];
        await userClient.savePreferences(user.id, preferences);

        await use({team, user, adminClient});
    },
});

export {expect};
