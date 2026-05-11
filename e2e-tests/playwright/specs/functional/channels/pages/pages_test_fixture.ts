// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {Client4} from '@mattermost/client';

import {
    test as base,
    expect,
    getAdminClient,
    createRandomTeam,
    getOnPremServerConfig,
    createRandomUser,
    getRandomId,
    makeClient,
} from '@mattermost/playwright-lib';

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
        channel: Channel;
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
export const test: ReturnType<typeof base.extend<PagesTestFixtures, PagesWorkerFixtures>> = base.extend<
    PagesTestFixtures,
    PagesWorkerFixtures
>({
    // Worker-scoped fixture: team and admin setup
    pagesWorkerSetup: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            // Login admin
            const {adminClient, adminUser} = await getAdminClient();

            // Reset server config with explicit TeammateNameDisplay setting
            // to ensure usernames are displayed in tests
            const config = getOnPremServerConfig() as any;
            config.TeamSettings.TeammateNameDisplay = 'username';
            config.TeamSettings.LockTeammateNameDisplay = false;
            await adminClient.updateConfig(config);

            // Snapshot before mutating so teardown can restore exactly.
            // Wiki/page permissions are team-scoped (SessionHasWikiPermission →
            // SessionHasPermissionToTeam), so they must be on team_user, not channel_user.
            // manage_wiki must NOT be granted to team_user: CanResolvePageComment and the
            // comment edit/delete path gate on it, so granting it to all members would
            // let any user resolve or edit others' comments.
            const teamUserRole = await adminClient.getRoleByName('team_user');
            const originalTeamUserPermissions = [...teamUserRole.permissions];
            const patchedTeamUserPermissions = new Set([
                ...originalTeamUserPermissions.filter((p) => p !== 'manage_wiki'),
                'create_wiki',
                'read_wiki',
                'create_page',
                'read_page',
                'edit_page',
                'delete_own_page',
            ]);
            await adminClient.patchRole(teamUserRole.id, {
                permissions: Array.from(patchedTeamUserPermissions),
            });

            // Create shared team for all pages tests in this worker
            const team = await adminClient.createTeam(await createRandomTeam('pages-team', 'Pages Team'));

            try {
                await use({team, adminUser: adminUser!, adminClient});
            } finally {
                await adminClient.patchRole(teamUserRole.id, {permissions: originalTeamUserPermissions});
            }
        },
        {scope: 'worker', timeout: 120000},
    ],

    // Test-scoped fixture: creates a fresh admin user for each test
    // Using admin bypasses all role-based permission checks,
    // avoiding HA cluster sync issues entirely.
    // Each test gets a dedicated user and a dedicated channel to avoid sharing
    // mutable state across tests. The channel is unique per test so wikis
    // created during the test don't accumulate against the server-side
    // MaxLinkedWikisPerChannel cap on a shared channel.
    sharedPagesSetup: async ({pagesWorkerSetup}, use) => {
        const {team, adminClient} = pagesWorkerSetup;

        // Create a new system admin user for this test
        const randomUser = await createRandomUser('pages-admin');
        const user = await adminClient.createUser(randomUser, '', '');
        user.password = randomUser.password;

        // Make the user a system admin
        await adminClient.updateUserRoles(user.id, 'system_user system_admin');

        // Add user to the team
        await adminClient.addToTeam(team.id, user.id);

        // Create a dedicated public channel for this test
        const channelSuffix = getRandomId();
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `pages-test-${channelSuffix}`,
            display_name: `Pages Test ${channelSuffix}`,
            type: 'O',
        } as Channel);
        await adminClient.addToChannel(user.id, channel.id);

        // Set user preferences (skip tutorial, show username as display name)
        const {client: userClient} = await makeClient(user);
        const preferences = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
            {user_id: user.id, category: 'display_settings', name: 'name_format', value: 'username'},
        ];
        await userClient.savePreferences(user.id, preferences);

        try {
            await use({team, user, adminClient, channel});
        } finally {
            await adminClient.deleteChannel(channel.id).catch(() => {});
        }
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
        channel: Channel;
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
export const testWithRegularUser: ReturnType<typeof base.extend<PermissionsTestFixtures, PermissionsWorkerFixtures>> =
    base.extend<PermissionsTestFixtures, PermissionsWorkerFixtures>({
        // Worker-scoped fixture: team and permission setup
        permissionsWorkerSetup: [
            // eslint-disable-next-line no-empty-pattern
            async ({}, use) => {
                // Login admin
                const {adminClient} = await getAdminClient();

                // Reset server config with explicit TeammateNameDisplay setting
                // to ensure usernames are displayed in tests
                const config = getOnPremServerConfig() as any;
                config.TeamSettings.TeammateNameDisplay = 'username';
                config.TeamSettings.LockTeammateNameDisplay = false;
                await adminClient.updateConfig(config);

                // Snapshot all roles before mutating so teardown can restore exactly.
                // This prevents cross-run and cross-worker permission pollution:
                // patchRole is additive, so without a restore stale grants accumulate.
                const channelUserRole = await adminClient.getRoleByName('channel_user');
                const channelGuestRole = await adminClient.getRoleByName('channel_guest');
                const teamGuestRole = await adminClient.getRoleByName('team_guest');
                const teamUserRole = await adminClient.getRoleByName('team_user');

                const originalChannelUserPermissions = [...channelUserRole.permissions];
                const originalChannelGuestPermissions = [...channelGuestRole.permissions];
                const originalTeamGuestPermissions = [...teamGuestRole.permissions];
                const originalTeamUserPermissions = [...teamUserRole.permissions];

                // channel_user: add wiki/page permissions so regular members can operate on pages.
                await adminClient.patchRole(channelUserRole.id, {
                    permissions: Array.from(new Set([...originalChannelUserPermissions, ...WIKI_PAGE_PERMISSIONS])),
                });

                // channel_guest: guests need read_page to view pages.
                await adminClient.patchRole(channelGuestRole.id, {
                    permissions: Array.from(new Set([...originalChannelGuestPermissions, 'read_page'])),
                });

                // team_guest: GetWikiForRead checks SessionHasWikiPermission(read_wiki) via
                // SessionHasPermissionToTeam — channel roles are never consulted. Guests need
                // read_wiki on their team role to load the wiki bundle (fetchWiki, fetchPages,
                // fetchWikiLinks all gate on it).
                await adminClient.patchRole(teamGuestRole.id, {
                    permissions: Array.from(new Set([...originalTeamGuestPermissions, 'read_wiki'])),
                });

                // team_user: add read_wiki so regular members can load wiki metadata.
                // manage_wiki must NOT be granted: CanResolvePageComment and the comment
                // edit/delete path gate on it, so granting it to all team_users lets any
                // member resolve or edit others' comments — breaking the permission tests.
                await adminClient.patchRole(teamUserRole.id, {
                    permissions: Array.from(
                        new Set([
                            ...originalTeamUserPermissions.filter((p) => p !== 'manage_wiki'),
                            'read_wiki',
                            'read_page',
                        ]),
                    ),
                });

                // Role cache sync in HA clusters is best-effort (ClusterSendBestEffort).
                // Permission tests that depend on immediate sync should be annotated
                // with test.fixme() in single-node CI where this delay is not needed.

                // Create shared team for all permission tests in this worker
                const team = await adminClient.createTeam(
                    await createRandomTeam('pages-perm-team', 'Pages Permission Team'),
                );

                try {
                    await use({team, adminClient});
                } finally {
                    await adminClient.patchRole(channelUserRole.id, {permissions: originalChannelUserPermissions});
                    await adminClient.patchRole(channelGuestRole.id, {permissions: originalChannelGuestPermissions});
                    await adminClient.patchRole(teamGuestRole.id, {permissions: originalTeamGuestPermissions});
                    await adminClient.patchRole(teamUserRole.id, {permissions: originalTeamUserPermissions});
                }
            },
            {scope: 'worker', timeout: 180000},
        ],

        // Test-scoped fixture: creates a fresh regular user for each test
        sharedPagesSetup: async ({permissionsWorkerSetup}, use) => {
            const {team, adminClient} = permissionsWorkerSetup;

            // Create a new regular user for this test
            const randomUser = await createRandomUser('pages-user');
            const user = await adminClient.createUser(randomUser, '', '');
            user.password = randomUser.password;
            await adminClient.addToTeam(team.id, user.id);

            // Create a dedicated public channel for this test
            const channelSuffix = getRandomId();
            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `pages-perm-test-${channelSuffix}`,
                display_name: `Pages Perm Test ${channelSuffix}`,
                type: 'O',
            } as Channel);
            await adminClient.addToChannel(user.id, channel.id);

            // Set user preferences (skip tutorial)
            const {client: userClient} = await makeClient(user);
            const preferences = [
                {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
                {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
            ];
            await userClient.savePreferences(user.id, preferences);

            await use({team, user, adminClient, channel});
        },
    });

export {expect};
