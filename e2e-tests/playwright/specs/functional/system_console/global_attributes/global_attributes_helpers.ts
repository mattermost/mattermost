// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {getAdminClient, licenseTier, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export const GLOBAL_ATTRIBUTES_ADMIN_PATH = '/admin_console/system_attributes/manage_attributes';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/global_attributes_table.tsx
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'access_control';
const OBJECT_TYPE = 'template';
const TARGET_TYPE = 'system';

// Server clamps per_page to this max (see web.PerPageMaximum in server/channels/web/params.go).
// Directory-mode search with no cursor sorts CreateAt ASC, so the default 60-item page only
// returns the oldest fields — request the max to reduce the risk of missing newer ones.
const MAX_PROPERTY_FIELDS_PER_PAGE = 200;

/**
 * Toggle via System Console config API. On servers without SplitKey, feature flags are
 * read-only from config (see server/config/store.go); effective values come from env
 * (e.g. MM_FEATUREFLAGS_GLOBALATTRIBUTES).
 */
export async function setGlobalAttributesFeatureFlag(adminClient: Client4, enabled: boolean) {
    await adminClient.patchConfig({
        FeatureFlags: {
            GlobalAttributes: enabled,
        },
    } as any);
}

/**
 * Shared precondition for every test that needs the Manage Attributes page actually
 * reachable (as opposed to the flag-off gate test, which deliberately doesn't need this):
 * skips on a sub-Enterprise license, enables the GlobalAttributes flag, and skips if the
 * flag didn't actually take (e.g. env/SplitKey overrides). Returns the admin session.
 */
export async function requireGlobalAttributesEnabled(pw: PlaywrightExtended) {
    await pw.skipIfNoLicense();
    const {adminUser, adminClient} = await getAdminClient();

    if (!adminUser || !adminClient) {
        throw new Error('Failed to get admin user');
    }

    const license = await adminClient.getClientLicenseOld();
    test.skip(
        licenseTier(license.SkuShortName) < 20,
        'Manage Attributes requires Enterprise-tier license (SkuShortName enterprise, entry, or advanced). ' +
            'Professional is not sufficient—the admin route is hidden and redirects away.',
    );

    await setGlobalAttributesFeatureFlag(adminClient, true);
    await pw.skipIfFeatureFlagNotSet('GlobalAttributes', true);

    return {adminUser, adminClient};
}

/**
 * Removes any access_control/template field with the given name (clean slate for E2E),
 * ignoring failures — the property routes may be unavailable when the feature flag is off,
 * or the field may simply not exist yet.
 */
export async function deleteGlobalAttributeFieldIfExists(adminClient: Client4, name: string) {
    try {
        const fields = await adminClient.getPropertyFields(
            PROPERTY_GROUP,
            OBJECT_TYPE,
            TARGET_TYPE,
            undefined,
            {perPage: MAX_PROPERTY_FIELDS_PER_PAGE},
        );
        for (const field of fields.filter((f) => f.name === name && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, OBJECT_TYPE, field.id);
        }
    } catch {
        // May not exist, or routes unavailable; ignore.
    }
}

/**
 * Creates an access_control/template property field (the same group/object type/target
 * this ticket's table lists) for E2E seeding. Ensures a clean slate first so reruns don't
 * collide with a field left over from a prior failed run.
 */
export async function createGlobalAttributeField(
    adminClient: Client4,
    name: string,
    field: Partial<Parameters<Client4['createPropertyField']>[2]>,
) {
    await deleteGlobalAttributeFieldIfExists(adminClient, name);

    return adminClient.createPropertyField(PROPERTY_GROUP, OBJECT_TYPE, {
        name,
        target_type: TARGET_TYPE,
        target_id: '',
        ...field,
    } as Parameters<Client4['createPropertyField']>[2]);
}
