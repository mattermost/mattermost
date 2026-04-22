// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

// Canonical values: webapp/channels/src/components/admin_console/classification_markings/utils/index.ts
// (cross-package import not feasible between e2e-tests and webapp)
const PROPERTY_GROUP = 'custom_profile_attributes';
const PROPERTY_OBJECT = 'template'; // template field is the schema source of truth (Linked Properties)
const TARGET_TYPE = 'system';
const CLASSIFICATION_FIELD_NAME = 'classification';

export const CLASSIFICATION_MARKINGS_ADMIN_PATH = '/admin_console/site_config/classification_markings';

/**
 * Toggle via System Console config API. On servers without SplitKey, feature flags are
 * read-only from config (see server/config/store.go); effective values come from env
 * (e.g. MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS). E2E docker sets that env in server.generate.sh.
 */
export async function setClassificationMarkingsFeatureFlag(adminClient: Client4, enabled: boolean) {
    const config = await adminClient.getConfig();
    // Full config round-trip; FeatureFlags is a wide record on the client type.
    await adminClient.updateConfig({
        ...config,
        FeatureFlags: {
            ...config.FeatureFlags,
            ClassificationMarkings: enabled,
        },
    } as Awaited<ReturnType<Client4['getConfig']>>);
}

/**
 * Removes the system classification property field if present (clean slate for E2E).
 */
export async function deleteClassificationMarkingsFieldIfExists(adminClient: Client4) {
    try {
        const fields = await adminClient.getPropertyFields(PROPERTY_GROUP, PROPERTY_OBJECT, TARGET_TYPE);
        const field = fields.find((f) => f.name === CLASSIFICATION_FIELD_NAME && f.delete_at === 0);
        if (field?.id) {
            await adminClient.deletePropertyField(PROPERTY_GROUP, PROPERTY_OBJECT, field.id);
        }
    } catch {
        // Property routes may be unavailable when the feature flag is off; ignore.
    }
}
