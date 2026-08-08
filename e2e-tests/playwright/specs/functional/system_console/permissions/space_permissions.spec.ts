// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getAdminClient, test} from '@mattermost/playwright-lib';

const SPACE_PERMISSIONS = ['read_space', 'create_space', 'manage_space', 'delete_space'];

// The roles the System Scheme editor rewrites on save. Captured before the save and put back
// afterwards: the editor does not patch the roles it was shown, it rebuilds every default role
// from the aggregated All Members / Guests trees, so a save here is a server-wide write that
// outlives this spec. Playwright shares one server across the suite (Testcontainers) or points at
// a persistent one (external), so leaving the rewrite in place would hand sibling specs a set of
// default roles nobody asked for.
const REWRITTEN_ROLES = [
    'team_user',
    'team_guest',
    'team_admin',
    'system_user',
    'system_guest',
    'channel_user',
    'channel_guest',
    'channel_admin',
    'playbook_admin',
    'playbook_member',
    'run_member',
];

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
// Snapshotted in the test and put back here, so the scheme save cannot outlive the spec.
let rolesBeforeSave: Array<{id: string; permissions: string[]}> = [];

type AdminClient = Awaited<ReturnType<typeof getAdminClient>>['adminClient'];

// Records the baseline at most once for the whole spec. Every test that saves the scheme needs a
// snapshot, but only the first one sees the pristine server: a save rebuilds the default roles from
// the aggregated trees and is not guaranteed to be net-zero, so re-snapshotting in a later test
// would record a rewritten set as the baseline and afterAll would restore the rewrite instead of
// undoing it.
const snapshotRewrittenRoles = async (adminClient: AdminClient) => {
    if (rolesBeforeSave.length) {
        return;
    }
    rolesBeforeSave = (await adminClient.getRolesByNames(REWRITTEN_ROLES)).map((role) => ({
        id: role.id,
        permissions: role.permissions,
    }));
};

test.afterAll(async () => {
    if (!rolesBeforeSave.length) {
        return;
    }
    const {adminClient} = await getAdminClient({skipLog: true});
    for (const role of rolesBeforeSave) {
        await adminClient.patchRole(role.id, {permissions: role.permissions});
    }
});

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

        // Captured before anything is saved: afterAll puts these back, because the save below
        // rewrites the whole default-role set on a server the rest of the suite shares.
        await snapshotRewrittenRoles(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.gotoPermissionsSystemScheme();
        await systemConsolePage.permissionsSystemScheme.toBeVisible();

        // The rows exist, so the permissions can be administered here at all.
        await systemConsolePage.permissionsSystemScheme.toHaveSpacePermissionRows('all_users', SPACE_PERMISSIONS);

        // Toggle an unrelated permission and put it straight back. The net edit is nothing, but the
        // editor latches "unsaved changes" on any interaction, so Save becomes available — the
        // everyday way an admin ends up saving this page without meaning to change anything on it.
        const unrelated = systemConsolePage.permissionsSystemScheme.getPermissionCheckbox(
            'all_users-posts-use_channel_mentions-checkbox',
        );
        const unrelatedWasChecked = await systemConsolePage.permissionsSystemScheme.isChecked(unrelated);
        await unrelated.click();
        await systemConsolePage.permissionsSystemScheme.expectCheckedState(unrelated, !unrelatedWasChecked);
        await unrelated.click();
        await systemConsolePage.permissionsSystemScheme.expectCheckedState(unrelated, unrelatedWasChecked);

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

/**
 * @objective Verify a Docs space permission can actually be toggled and saved through the System
 * Scheme editor, and that the toggle persists across a page reload rather than only in the form's
 * in-memory state.
 *
 * @precondition
 * A server built from the paired core branch, booted with EnableDocs on — flags are read only at
 * boot, so this asserts the flag rather than switching it. That holds in either mode: Testcontainers
 * (the suite owns the server) or external (PW_BASE_URL points at an already-running one).
 */
test(
    'toggles a space permission in the System Scheme and its saved value survives a reload',
    {tag: ['@system_console', '@permissions']},
    async ({pw}) => {
        const {adminUser, adminClient} = await pw.initSetup();

        const config = await adminClient.getConfig();
        expect(
            String(config.FeatureFlags?.EnableDocs),
            'EnableDocs must be on — boot the server with MM_FEATUREFLAGS_ENABLEDOCS=true',
        ).toBe('true');

        // Captured before anything is saved: afterAll puts these back, because the save below
        // rewrites the whole default-role set on a server the rest of the suite shares.
        await snapshotRewrittenRoles(adminClient);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await systemConsolePage.gotoPermissionsSystemScheme();
        await systemConsolePage.permissionsSystemScheme.toBeVisible();

        // create_space is team_scope, so the toggle below lands on the team_user role.
        const permission = 'create_space';
        const checkbox = systemConsolePage.permissionsSystemScheme.getSpacePermissionCheckbox('all_users', permission);
        const wasChecked = await systemConsolePage.permissionsSystemScheme.isChecked(checkbox);

        // # Toggle the permission and confirm the click actually flips the checkbox.
        await checkbox.click();
        await systemConsolePage.permissionsSystemScheme.expectCheckedState(checkbox, !wasChecked);

        // # Save the scheme with the toggled permission.
        await systemConsolePage.permissionsSystemScheme.save();

        // * The role that owns the team-scoped permission reflects the toggle on the server.
        const teamUserAfterToggle = await adminClient.getRoleByName('team_user');
        if (wasChecked) {
            expect(teamUserAfterToggle.permissions).not.toContain(permission);
        } else {
            expect(teamUserAfterToggle.permissions).toContain(permission);
        }

        // # Reload the editor so the assertion below proves the toggle survived a save, not just
        // that the form still held its own in-memory state.
        await systemConsolePage.gotoPermissionsSystemScheme();
        await systemConsolePage.permissionsSystemScheme.toBeVisible();

        // * The checkbox reflects the saved (toggled) value after the reload.
        const checkboxAfterReload = systemConsolePage.permissionsSystemScheme.getSpacePermissionCheckbox(
            'all_users',
            permission,
        );
        await systemConsolePage.permissionsSystemScheme.expectCheckedState(checkboxAfterReload, !wasChecked);

        // # Toggle the permission back and save, restoring the pre-test state.
        await checkboxAfterReload.click();
        await systemConsolePage.permissionsSystemScheme.expectCheckedState(checkboxAfterReload, wasChecked);
        await systemConsolePage.permissionsSystemScheme.save();

        // * The permission is back to its original state on the server.
        const teamUserRestored = await adminClient.getRoleByName('team_user');
        if (wasChecked) {
            expect(teamUserRestored.permissions).toContain(permission);
        } else {
            expect(teamUserRestored.permissions).not.toContain(permission);
        }
    },
);
