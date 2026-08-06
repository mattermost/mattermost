// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

const SPACE_PERMISSIONS = ['read_space', 'create_space', 'manage_space', 'delete_space'];

/**
 * @objective Verify the team-scoped Docs space permissions are administrable in the System Scheme
 * editor, and that saving the scheme preserves them on the roles that hold them.
 *
 * The save half is the one that matters. The editor does not persist a role's stored permission
 * list: it rebuilds the aggregated All Members / Guests roles and re-splits them by the webapp's
 * PermissionsScope map. A permission missing from that map is dropped from every role on save, so
 * an admin saving the scheme for an unrelated reason would silently revoke it — and the seeding
 * migration never restores it, because its key is already recorded. A component test can assert
 * the save path in isolation; only this asserts it through the editor an admin actually uses.
 *
 * @precondition
 * A server built from the paired core branch, booted with EnableDocs on — flags are read only at
 * boot, so this asserts the flag rather than switching it. That holds in either mode: Testcontainers
 * (the suite owns the server) or external (PW_BASE_URL points at an already-running one).
 */
test(
    'space permissions render in the System Scheme and survive a save',
    {tag: ['@system_console', '@permissions']},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        // Asserted, not switched: ensureFeatureFlag restarts the server to change a boot-time flag,
        // which ties the spec to Testcontainers and remaps the port out from under the browser
        // context. Failing loudly here says exactly which prerequisite is missing.
        const config = await adminClient.getConfig();
        expect(
            String(config.FeatureFlags?.EnableDocs),
            'EnableDocs must be on — boot the server with MM_FEATUREFLAGS_ENABLEDOCS=true',
        ).toBe('true');

        // The grants the seeding migration leaves behind — the state a save must not disturb.
        const before = await adminClient.getRolesByNames(['team_user', 'team_guest', 'team_admin']);
        const permissionsOf = (roles: typeof before, name: string) =>
            roles.find((role) => role.name === name)?.permissions ?? [];

        expect(permissionsOf(before, 'team_user')).toEqual(expect.arrayContaining(['read_space', 'create_space']));
        expect(permissionsOf(before, 'team_guest')).toEqual(expect.arrayContaining(['read_space']));
        expect(permissionsOf(before, 'team_admin')).toEqual(expect.arrayContaining(['manage_space', 'delete_space']));

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.gotoPermissionsSystemScheme();
        await systemConsolePage.permissionsSystemScheme.toBeVisible();

        // The rows exist, so the permissions can be administered here at all.
        await systemConsolePage.permissionsSystemScheme.toHaveSpacePermissionRows('all_users');

        // Toggle an unrelated permission and put it straight back. The net edit is nothing, but the
        // editor latches "unsaved changes" on any interaction, so Save becomes available — the
        // everyday way an admin ends up saving this page without meaning to change anything on it.
        const unrelated = systemConsolePage.permissionsSystemScheme.getPermissionCheckbox(
            'all_users-posts-use_channel_mentions-checkbox',
        );
        await unrelated.click();
        await unrelated.click();

        await systemConsolePage.permissionsSystemScheme.save();

        const after = await adminClient.getRolesByNames(['team_user', 'team_guest', 'team_admin']);

        expect(permissionsOf(after, 'team_user')).toEqual(expect.arrayContaining(['read_space', 'create_space']));
        expect(permissionsOf(after, 'team_admin')).toEqual(expect.arrayContaining(['manage_space', 'delete_space']));

        // Exactly once for the guest role: it is restored by a different path from the other two
        // (the guest tree re-adds permissions it does not manage), so a permission that is both
        // scope-mapped and tree-managed would otherwise accumulate a duplicate on every save.
        const guestReadSpace = permissionsOf(after, 'team_guest').filter((p) => p === 'read_space');
        expect(guestReadSpace).toHaveLength(1);

        // No space permission may leak onto a role that never held one: the four are team-scoped,
        // and the re-split is exactly where a mis-scoped entry would deposit them elsewhere.
        const systemUser = await adminClient.getRoleByName('system_user');
        for (const permission of SPACE_PERMISSIONS) {
            expect(systemUser.permissions).not.toContain(permission);
        }

        // The unrelated permission is back where it started, confirming the save carried a net-zero
        // edit — so anything that did change came from the save path, not from the test.
        const channelUser = await adminClient.getRoleByName('channel_user');
        expect(channelUser.permissions).toContain('use_channel_mentions');
    },
);
