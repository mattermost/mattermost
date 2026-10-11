// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {licenseTier, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export {deletePolicyById, ensureABACEnabled} from '../burn_on_read/helpers';

export const DM_GM_START = 'dm_gm_start';
export const DM_GM_READ_ACCESS = 'dm_gm_read_access';
export const DM_GM_WRITE_ACCESS = 'dm_gm_write_access';

/**
 * Long enough for a client to react to a policy change on its own: the server broadcasts
 * permission_policy_updated, and the webapp refetches its DM/GM decisions after a random
 * delay of up to 5 s so every client doesn't refetch at once.
 */
export const POLICY_PROPAGATION_TIMEOUT = 20_000;

/**
 * Feature flag, licence and tier checks every DM/GM spec starts with, in that order. Call it
 * at the top of each test: the flag is a server restart in testcontainers mode, and every
 * test in these files asks for the same flags so a file restarts at most once.
 */
export async function prepareDmGmTest(
    pw: PlaywrightExtended,
    flags: Record<string, boolean> = {PermissionPolicies: true},
) {
    await pw.ensureFeatureFlag(flags);
    await pw.skipIfNoLicense();

    const {adminClient} = await pw.getAdminClient();
    const license = await adminClient.getClientLicenseOld();
    test.skip(licenseTier(license.SkuShortName) < 30, 'Permission policies require an Enterprise Advanced licence.');
}

/**
 * Deny one user and allow everyone else, keyed on the native user.email field so no custom
 * attribute has to be provisioned.
 *
 * Deny-all would block the admin's own setup: a system admin without an admin-specific
 * policy falls back to the Members policy, so it would lose DMs too.
 */
export function denyOnly(email: string): string {
    return `user.email != '${email}'`;
}

/**
 * Create or replace a system permission policy carrying the given DM/GM actions. A copy of
 * upsertSystemPolicy (burn_on_read/helpers.ts) with an actions parameter.
 *
 * Pass an existing id to replace the policy in place rather than add a second one, which
 * would be AND'd with the first.
 */
export async function upsertDmGmPolicy(
    adminClient: Client4,
    options: {name: string; actions: string[]; expression: string; id?: string; role?: string},
): Promise<string> {
    const saved: any = await (adminClient as any).doFetch(`${adminClient.getBaseRoute()}/access_control_policies`, {
        method: 'PUT',
        body: JSON.stringify({
            id: options.id ?? '',
            name: options.name,
            type: 'permission',
            active: true,
            revision: 1,
            version: 'v0.3',

            // v0.3 accepts exactly one system role on a permission policy.
            roles: [options.role ?? 'system_user'],
            imports: [],
            rules: [{actions: options.actions, expression: options.expression}],
            props: {},
        }),
    });
    return saved.id;
}

/**
 * A DM between the user and partner and a GM with two more teammates, both shown in the
 * user's sidebar.
 */
export async function createConversations(
    userClient: Client4,
    user: UserProfile,
    partner: UserProfile,
    gmMembers: UserProfile[],
): Promise<{dm: Channel; gm: Channel}> {
    const dm = await userClient.createDirectChannel([user.id, partner.id]);
    const gm = await userClient.createGroupChannel([user.id, ...gmMembers.map((member) => member.id)]);

    await userClient.savePreferences(user.id, [
        {user_id: user.id, category: 'direct_channel_show', name: partner.id, value: 'true'},
        {user_id: user.id, category: 'group_channel_show', name: gm.id, value: 'true'},
    ]);

    return {dm, gm};
}
