// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP, DISPLAY_BANNER_BOTTOM, DISPLAY_BANNER_TOP} from 'mattermost-redux/constants/properties';

import type {ClassificationLevel} from './presets';
import {PRESET_CUSTOM, presets} from './presets';

// ---------------------------------------------------------------------------
// Property-field identifiers for the classification-markings feature.
//
// Three logical fields participate:
//   1. Template field  — canonical schema (Linked Properties template). The
//                        admin defines the level options here; per-channel
//                        and system fields link to it and inherit them.
//   2. System field    — linked-to-template; drives the GLOBAL banner. Lives
//                        on the dedicated 'system' object-type path
//                        introduced in #36250.
//   3. Channel field   — linked-to-template; drives PER-CHANNEL banners.
//
// All three fields are scoped server-side as system fields, so they share the
// same field-level target attributes (`target_type='system'`, `target_id=''`).
// Property *values* for the system field are stored on the dedicated system
// endpoint and use the sentinel target_id 'system'.
// ---------------------------------------------------------------------------

// Field-level target attributes shared by template, system, and channel fields.
// `target_type` is always 'system'; `target_id` is empty for system-scoped
// field definitions (the server canonicalizes both).
export const CLASSIFICATIONS_FIELD_TARGET_TYPE = 'system';
export const CLASSIFICATIONS_FIELD_TARGET_ID = '';

// Template field — the canonical schema.
export const CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE = 'template';
export const CLASSIFICATIONS_TEMPLATE_FIELD_NAME = 'classification';

// Classification levels are an ordered scale, so every field this feature owns is
// rank-typed. A same-named field of any other type belongs to something else.
export const CLASSIFICATIONS_FIELD_TYPE: PropertyField['type'] = 'rank';

// Returned by the server when a create would duplicate a live name within an
// object type. Distinguishes a create conflict from the delete-dependents
// conflict, which shares its HTTP status.
export const PROPERTY_FIELD_NAME_CONFLICT_ERROR_ID = 'app.property_field.create.name_conflict.app_error';

// Admin console path for the Classification Markings page (System Console > Site
// Configuration). Used by the Attribute Management listing to link its read-only row here.
export const CLASSIFICATIONS_MARKINGS_ADMIN_URL = '/admin_console/site_config/classification_markings';

// System field — drives the global banner. Property *values* live on the
// dedicated system endpoint and use the sentinel target_id 'system'.
export const CLASSIFICATIONS_SYSTEM_OBJECT_TYPE = 'system';
export const CLASSIFICATIONS_SYSTEM_FIELD_NAME = 'classification';
export const CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID = 'system';

// Channel field — drives the per-channel banner.
export const CLASSIFICATIONS_CHANNEL_OBJECT_TYPE = 'channel';
export const CLASSIFICATIONS_CHANNEL_FIELD_NAME = 'classification';

export type GlobalBannerPlacement = 'top' | 'top_and_bottom';

export type GlobalBannerConfig = {
    enabled: boolean;
    placement: GlobalBannerPlacement;
    level_id: string;
};

export const DEFAULT_GLOBAL_BANNER: GlobalBannerConfig = {
    enabled: false,
    placement: 'top',
    level_id: '',
};

// --- Placement ↔ actions conversion ---

/**
 * Converts banner UI config to the actions array stored on the linked field's attrs.actions.
 * Returns empty array when the banner is disabled.
 */
export function placementToActions(config: GlobalBannerConfig): string[] {
    if (!config.enabled) {
        return [];
    }
    if (config.placement === 'top_and_bottom') {
        return [DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM];
    }
    return [DISPLAY_BANNER_TOP];
}

/**
 * Reconstructs GlobalBannerConfig from the linked field's attrs.actions and a resolved level ID.
 */
export function actionsToGlobalBanner(actions: string[], levelId: string): GlobalBannerConfig {
    const hasTop = actions.includes(DISPLAY_BANNER_TOP);
    if (!hasTop) {
        return {...DEFAULT_GLOBAL_BANNER};
    }
    const hasBottom = actions.includes(DISPLAY_BANNER_BOTTOM);
    return {
        enabled: true,
        placement: hasBottom ? 'top_and_bottom' : 'top',
        level_id: levelId,
    };
}

// --- Option ID ↔ level name helpers ---

export function findOptionIdByName(options: PropertyFieldOption[], name: string): string | undefined {
    return options.find((o) => o.name === name)?.id;
}

export function findOptionById(options: PropertyFieldOption[], id: string): PropertyFieldOption | undefined {
    return options.find((o) => o.id === id);
}

// --- Classification level helpers ---

export function detectPreset(levels: ClassificationLevel[]): string {
    for (const preset of presets) {
        if (preset.levels.length !== levels.length) {
            continue;
        }
        const matches = preset.levels.every((presetLevel, i) => {
            const level = levels[i];
            return presetLevel.name === level.name && presetLevel.color.toUpperCase() === level.color.toUpperCase() && presetLevel.rank === level.rank;
        });
        if (matches) {
            return preset.id;
        }
    }
    return PRESET_CUSTOM;
}

export function optionsToLevels(options: PropertyFieldOption[]): ClassificationLevel[] {
    return options.map((opt, i) => ({
        id: opt.id,
        name: opt.name,
        color: opt.color || '#000000',
        rank: opt.rank ?? (i + 1),
    })).sort((a, b) => a.rank - b.rank);
}

export function levelsToOptions(levels: ClassificationLevel[]): Array<{id: string; name: string; color: string; rank: number}> {
    return levels.map((level) => ({
        id: level.id.startsWith('pending_') ? '' : level.id,
        name: level.name,
        color: level.color,
        rank: level.rank,
    }));
}

export function processClassificationField(field: PropertyField): {levels: ClassificationLevel[]; presetId: string} {
    const options = (field.attrs?.options as PropertyFieldOption[]) || [];
    const levels = optionsToLevels(options);
    const presetId = detectPreset(levels);
    return {levels, presetId};
}

// --- Field lookup ---

/**
 * Outcome of looking one of this feature's fields up by name.
 *
 * `field` is set only when the match also passes the ownership check for its role
 * — rank type for the template, correct link target for the instances. A match
 * that fails one is reported as `conflict` instead: names are unique per object
 * type, so the feature can neither adopt it nor create its own alongside it.
 */
export type ClassificationFieldLookup = {
    field?: PropertyField;
    conflict?: PropertyField;
};

/**
 * Whether an instance field belongs to the given template. An empty templateId
 * means no template exists yet, which nothing can legitimately link to.
 */
function isLinkedTo(field: PropertyField, templateFieldId: string): boolean {
    return templateFieldId !== '' && field.linked_field_id === templateFieldId;
}

/**
 * Finds the one live field with the given name in an object type. The server
 * enforces name uniqueness per (object type, group, target) on live fields, so
 * the first match is the only one.
 */
async function findLiveFieldByName(objectType: string, name: string): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields( // eslint-disable-line no-await-in-loop
            ACCESS_CONTROL_PROPERTY_GROUP,
            objectType,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            {cursorId, cursorCreateAt},
        );
        const found = fields.find((f: PropertyField) => f.name === name && f.delete_at === 0);
        if (found || fields.length === 0) {
            return found;
        }

        fetched += fields.length;
        const last = fields[fields.length - 1];
        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }

    return undefined;
}

// --- Template field API ---

export async function fetchClassificationField(): Promise<ClassificationFieldLookup> {
    const match = await findLiveFieldByName(CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, CLASSIFICATIONS_TEMPLATE_FIELD_NAME);
    if (!match) {
        return {};
    }
    return match.type === CLASSIFICATIONS_FIELD_TYPE ? {field: match} : {conflict: match};
}

export async function saveCreateField(levels: ClassificationLevel[]): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    return Client4.createPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, {
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        type: CLASSIFICATIONS_FIELD_TYPE,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        attrs: {options},
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function saveDeleteField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, fieldId);
}

export async function savePatchField(fieldId: string, levels: ClassificationLevel[]): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    return Client4.patchPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, fieldId, {
        attrs: {options},
    } as Partial<PropertyField>);
}

// --- System field API (drives the global banner) ---

export async function fetchLinkedClassificationField(templateFieldId: string): Promise<ClassificationFieldLookup> {
    const match = await findLiveFieldByName(CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, CLASSIFICATIONS_SYSTEM_FIELD_NAME);
    if (!match) {
        return {};
    }
    return isLinkedTo(match, templateFieldId) ? {field: match} : {conflict: match};
}

export async function saveCreateLinkedField(templateFieldId: string, config: GlobalBannerConfig): Promise<PropertyField> {
    return Client4.createPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, {
        name: CLASSIFICATIONS_SYSTEM_FIELD_NAME,
        type: CLASSIFICATIONS_FIELD_TYPE,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        linked_field_id: templateFieldId,
        attrs: {
            actions: placementToActions(config),
        },
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function savePatchLinkedField(linkedFieldId: string, config: GlobalBannerConfig): Promise<PropertyField> {
    return Client4.patchPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, linkedFieldId, {
        attrs: {
            actions: placementToActions(config),
        },
    } as Partial<PropertyField>);
}

export async function saveDeleteLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, fieldId);
}

// --- System classification property value API ---

/**
 * Fetches the currently stored option ID for the system classification level.
 * Uses the dedicated system values endpoint (no target_id in URL).
 */
export async function fetchSystemClassificationValue(linkedFieldId: string): Promise<string | undefined> {
    const values = await Client4.getSystemPropertyValues<string>(ACCESS_CONTROL_PROPERTY_GROUP);
    const match = ((values as Array<PropertyValue<string>>) ?? []).find((v) => v.field_id === linkedFieldId);
    return match?.value;
}

/**
 * Upserts the system classification property value to the given option ID.
 * Uses the dedicated system values endpoint (sentinel target_id 'system').
 * Returns the saved property values so callers can eagerly update the store.
 */
export async function saveUpsertSystemValue(linkedFieldId: string, optionId: string): Promise<Array<PropertyValue<string>>> {
    return Client4.patchSystemPropertyValues<string>(ACCESS_CONTROL_PROPERTY_GROUP, [
        {field_id: linkedFieldId, value: optionId},
    ]);
}

// --- Channel field API (drives per-channel banners) ---

export async function fetchChannelClassificationField(templateFieldId: string): Promise<ClassificationFieldLookup> {
    const match = await findLiveFieldByName(CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, CLASSIFICATIONS_CHANNEL_FIELD_NAME);
    if (!match) {
        return {};
    }
    return isLinkedTo(match, templateFieldId) ? {field: match} : {conflict: match};
}

export async function saveCreateChannelLinkedField(templateFieldId: string): Promise<PropertyField> {
    return Client4.createPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, {
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: CLASSIFICATIONS_FIELD_TYPE,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        linked_field_id: templateFieldId,
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function saveDeleteChannelLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, fieldId);
}

// --- User field API (clearance attribute for classification enforcement) ---
//
// A user field linked to the template mirrors the classification levels as its
// option scale, so ABAC policies can gate access with `user.attributes.<name>`
// compared against a channel's classification. Values are inherited wholesale
// from the template (no per-level mapping), exactly like the channel field.

export const CLASSIFICATIONS_USER_OBJECT_TYPE = 'user';

// Default name/label for the clearance field created from this page. The name
// is fixed: CEL rule authors write it directly as user.attributes.clearance, so
// renaming it would break existing rules. It is lowercase like
// CLASSIFICATIONS_CHANNEL_FIELD_NAME; the display name is the label the System
// Console and profile popovers show.
export const CLEARANCE_FIELD_NAME = 'clearance';
export const CLEARANCE_FIELD_DISPLAY_NAME = 'Clearance';

export type ClearanceFieldLookup = {

    /**
     * Every live user field linked to the classification template. The
     * enforcement checkbox is on when this is non-empty, and disabling
     * classification markings deletes all of them, so it is the whole set
     * rather than just the first match.
     */
    fields: PropertyField[];

    /**
     * A live user field holding the clearance name without being linked to the
     * template. Creating the clearance field would collide with it. At most one,
     * since names are unique per object type.
     */
    conflict?: PropertyField;
};

export async function fetchUserLinkedFields(templateFieldId: string): Promise<ClearanceFieldLookup> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;
    const result: ClearanceFieldLookup = {fields: []};

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields( // eslint-disable-line no-await-in-loop
            ACCESS_CONTROL_PROPERTY_GROUP,
            CLASSIFICATIONS_USER_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            {cursorId, cursorCreateAt},
        );
        for (const f of fields) {
            if (f.delete_at !== 0) {
                continue;
            }
            if (isLinkedTo(f, templateFieldId)) {
                result.fields.push(f);
            } else if (f.name === CLEARANCE_FIELD_NAME) {
                result.conflict = f;
            }
        }
        if (fields.length === 0) {
            return result;
        }

        fetched += fields.length;
        const last = fields[fields.length - 1];
        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }

    return result;
}

export async function saveCreateUserLinkedField(templateFieldId: string, name: string, displayName: string): Promise<PropertyField> {
    return Client4.createPropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_USER_OBJECT_TYPE, {
        name,
        type: CLASSIFICATIONS_FIELD_TYPE,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        linked_field_id: templateFieldId,

        // Admin-managed: clearance is assigned by an admin/integration, so users
        // cannot self-edit their own value.
        attrs: {managed: 'admin', display_name: displayName},
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function saveDeleteUserLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(ACCESS_CONTROL_PROPERTY_GROUP, CLASSIFICATIONS_USER_OBJECT_TYPE, fieldId);
}
