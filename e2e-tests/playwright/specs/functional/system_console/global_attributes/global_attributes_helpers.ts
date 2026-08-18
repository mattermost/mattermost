// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {PropertyField} from '@mattermost/types/properties';

import {getAdminClient, licenseTier, test} from '@mattermost/playwright-lib';
import type {PlaywrightExtended} from '@mattermost/playwright-lib';

export const GLOBAL_ATTRIBUTES_ADMIN_PATH = '/admin_console/system_attributes/manage_attributes';

// Canonical values: webapp/channels/src/components/admin_console/global_attributes/constants.ts
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'access_control';
const OBJECT_TYPE = 'template';
const TARGET_TYPE = 'system';

// The three resource object types an Applies-to linked field can use. Also the
// only object types (besides 'template') PropertyField.IsValid allows a linked
// field to carry -- a template field itself is rejected for having a
// linked_field_id ("template fields cannot have a linked field").
// Canonical values: webapp/channels/.../attribute_details/attribute_applies_to_constants.tsx
export type ResourceObjectType = 'user' | 'channel' | 'post';
const ALL_RESOURCE_OBJECT_TYPES: ResourceObjectType[] = ['user', 'channel', 'post'];

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
 * Creates a field that links to `sourceFieldId` (e.g. the template). Two uses:
 * seeding an already-saved Applies-to resource for a given `objectType`
 * (defaulting to 'user', the one pre-existing call site's shape), and making
 * the server refuse to delete the source field -- deletePropertyField counts
 * live linked dependents and returns 409 `has_linked_dependents` when any
 * exist (server/channels/app/properties/property_field.go), which this is
 * the only way to exercise against a real server response. The create flow
 * for a fresh Applies-to resource itself is exercised through the UI, not
 * this helper.
 */
export async function createLinkedDependentField(
    adminClient: Client4,
    name: string,
    sourceFieldId: string,
    type: string,
    objectType: ResourceObjectType = 'user',
) {
    return adminClient.createPropertyField(PROPERTY_GROUP, objectType, {
        name,
        type,
        target_type: TARGET_TYPE,
        target_id: '',
        linked_field_id: sourceFieldId,
    } as Parameters<Client4['createPropertyField']>[2]);
}

/**
 * Deletes a linked property field, ignoring failures -- mirrors deleteGlobalAttributeFieldIfExists'
 * best-effort cleanup style, since a test's own save/rollback assertions may have already deleted it.
 * Must run BEFORE deleting the field it points at -- the source delete stays blocked with a 409
 * for as long as a live dependent exists.
 */
export async function deleteLinkedDependentField(
    adminClient: Client4,
    fieldId: string,
    objectType: ResourceObjectType = 'user',
) {
    try {
        await adminClient.deletePropertyField(PROPERTY_GROUP, objectType, fieldId);
    } catch {
        // May already be gone (e.g. a prior rollback already deleted it); ignore.
    }
}

/**
 * Finds every linked field (across all three resource object types) pointing at `templateFieldId`.
 * Queries user/channel/post separately -- there is no single "all object types" listing endpoint --
 * and requests the max page size per call, since the `user` object type's result page is shared
 * with every Custom Profile Attributes field on the server (see deleteGlobalAttributeFieldIfExists'
 * own MAX_PROPERTY_FIELDS_PER_PAGE comment) and a freshly-created linked field is exactly the kind
 * of newest-row a default ascending-CreateAt page can drop.
 */
export async function fetchLinkedFieldsForTemplate(
    adminClient: Client4,
    templateFieldId: string,
): Promise<PropertyField[]> {
    const results = await Promise.all(
        ALL_RESOURCE_OBJECT_TYPES.map((objectType) =>
            adminClient.getPropertyFields(PROPERTY_GROUP, objectType, TARGET_TYPE, undefined, {
                perPage: MAX_PROPERTY_FIELDS_PER_PAGE,
            }),
        ),
    );

    return results.flat().filter((field) => field.linked_field_id === templateFieldId && field.delete_at === 0);
}
