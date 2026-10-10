// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {defaultRolesPermissions} from './default_roles_permissions';
import {getAdminClientHealing} from './admin_lockout';

/** Resets built-in roles to their default permissions; patches only roles that drifted. */
export async function resetRoles(adminClient?: Client4) {
    const client = adminClient ?? (await getAdminClientHealing()).adminClient;
    const roles = await client.getRolesByNames(Object.keys(defaultRolesPermissions));

    for (const role of roles) {
        const expected = (defaultRolesPermissions as Record<string, string>)[role.name]?.split(' ').filter(Boolean);
        if (!expected) {
            continue;
        }

        const current = role.permissions as string[];
        const drifted = current.length !== expected.length || expected.some((p) => !current.includes(p));
        if (drifted) {
            await client.patchRole(role.id, {permissions: expected});
        }
    }
}
