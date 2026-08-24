// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {getAdminClient, licenseTier, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export const GLOBAL_ATTRIBUTES_ADMIN_PATH = '/admin_console/system_attributes/manage_attributes';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/constants.ts
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'access_control';
const OBJECT_TYPE = 'template';
const TARGET_TYPE = 'system';

// Object type used to seed a field that *links to* a template field. It has to be
// anything but 'template': PropertyField.IsValid rejects a template field carrying a
// linked_field_id ("template fields cannot have a linked field"). 'user' matches the
// shape the store's own CountLinkedFields coverage uses.
const LINKED_OBJECT_TYPE = 'user';

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
 * Hierarchical (graph) authoring is gated on PropertyFieldGraph, which cannot be
 * flipped through the config API — the config store restores feature flags on write,
 * so the server must boot with MM_FEATUREFLAGS_PROPERTYFIELDGRAPH=true. Skips rather
 * than failing on a server that has not opted in.
 */
export async function requireHierarchicalAttributesEnabled(pw: PlaywrightExtended) {
    const session = await requireGlobalAttributesEnabled(pw);
    // Accept boolean or "true": getConfig() types FeatureFlags as booleans, but
    // env-driven flags sometimes round-trip as strings. skipIfFeatureFlagNotSet is
    // strict !==, which would skip a live graph server that returned "true".
    const config = await session.adminClient.getConfig();
    const enabled = config?.FeatureFlags?.PropertyFieldGraph;
    test.skip(
        enabled !== true && enabled !== 'true',
        'Skipping test - PropertyFieldGraph feature flag is not enabled on the server',
    );
    return session;
}

/**
 * Removes any access_control/template field with the given name (clean slate for E2E),
 * ignoring failures — the property routes may be unavailable when the feature flag is off,
 * or the field may simply not exist yet.
 */
export async function deleteGlobalAttributeFieldIfExists(adminClient: Client4, name: string) {
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, OBJECT_TYPE, TARGET_TYPE, undefined, {
            perPage: MAX_PROPERTY_FIELDS_PER_PAGE,
        });
        for (const field of fields.filter((f) => f.name === name && f.delete_at === 0)) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, OBJECT_TYPE, field.id);
        }
    } catch {
        // May not exist, or routes unavailable; ignore.
    }
}

/**
 * Returns the live access_control/template field with the given name, or undefined
 * if it is missing. Used to inspect the saved graph payload after a UI save.
 */
export async function getGlobalAttributeFieldByName(adminClient: Client4, name: string) {
    const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, OBJECT_TYPE, TARGET_TYPE, undefined, {
        perPage: MAX_PROPERTY_FIELDS_PER_PAGE,
    });
    return fields.find((f) => f.name === name && f.delete_at === 0);
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

/**
 * Creates a field that links to `sourceFieldId`, which makes the server refuse to delete
 * that source field: deletePropertyField counts live linked dependents and returns 409
 * `has_linked_dependents` when any exist (server/channels/app/properties/property_field.go).
 * This is the only way to exercise the listing's 409 branch against a real server response.
 */
export async function createLinkedDependentField(
    adminClient: Client4,
    name: string,
    sourceFieldId: string,
    type: string,
) {
    return adminClient.createPropertyField(PROPERTY_GROUP, LINKED_OBJECT_TYPE, {
        name,
        type,
        target_type: TARGET_TYPE,
        target_id: '',
        linked_field_id: sourceFieldId,
    } as unknown as Parameters<Client4['createPropertyField']>[2]);
}

/**
 * Deletes a linked dependent field by id, ignoring failures (it may already be gone).
 * Must run BEFORE deleting the field it points at — the source delete stays blocked
 * with a 409 for as long as a live dependent exists.
 */
export async function deleteLinkedDependentField(adminClient: Client4, fieldId: string) {
    try {
        await adminClient.deletePropertyField(PROPERTY_GROUP, LINKED_OBJECT_TYPE, fieldId);
    } catch {
        // Already deleted, or routes unavailable; ignore.
    }
}
