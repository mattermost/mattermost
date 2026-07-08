// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

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

// Property-field group for all classification-markings entities.
export const CLASSIFICATIONS_GROUP_NAME = 'access_control';

// Field-level target attributes shared by template, system, and channel fields.
// `target_type` is always 'system'; `target_id` is empty for system-scoped
// field definitions (the server canonicalizes both).
export const CLASSIFICATIONS_FIELD_TARGET_TYPE = 'system';
export const CLASSIFICATIONS_FIELD_TARGET_ID = '';

// Template field — the canonical schema.
export const CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE = 'template';
export const CLASSIFICATIONS_TEMPLATE_FIELD_NAME = 'classification';

// System field — drives the global banner. Property *values* live on the
// dedicated system endpoint and use the sentinel target_id 'system'.
export const CLASSIFICATIONS_SYSTEM_OBJECT_TYPE = 'system';
export const CLASSIFICATIONS_SYSTEM_FIELD_NAME = 'classification';
export const CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID = 'system';

// Channel field — drives the per-channel banner.
export const CLASSIFICATIONS_CHANNEL_OBJECT_TYPE = 'channel';
export const CLASSIFICATIONS_CHANNEL_FIELD_NAME = 'classification';

// Actions stored on the linked fields' attrs.actions to control banner placement.
export const DISPLAY_BANNER_TOP = 'display_banner_top';
export const DISPLAY_BANNER_BOTTOM = 'display_banner_bottom';

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

// --- Template field API ---

export async function fetchClassificationField(): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields( // eslint-disable-line no-await-in-loop
            CLASSIFICATIONS_GROUP_NAME,
            CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            {cursorId, cursorCreateAt},
        );
        const found = fields.find((f: PropertyField) => f.name === CLASSIFICATIONS_TEMPLATE_FIELD_NAME && f.delete_at === 0);
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

export async function saveCreateField(levels: ClassificationLevel[]): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    return Client4.createPropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, {
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        type: 'rank' as PropertyField['type'],
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        attrs: {options},
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function saveDeleteField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, fieldId);
}

export async function savePatchField(fieldId: string, levels: ClassificationLevel[]): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    return Client4.patchPropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE, fieldId, {
        attrs: {options},
    } as Partial<PropertyField>);
}

// --- System field API (drives the global banner) ---

export async function fetchLinkedClassificationField(): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields( // eslint-disable-line no-await-in-loop
            CLASSIFICATIONS_GROUP_NAME,
            CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            {cursorId, cursorCreateAt},
        );
        const found = fields.find((f: PropertyField) => f.name === CLASSIFICATIONS_SYSTEM_FIELD_NAME && f.delete_at === 0 && f.linked_field_id);
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

export async function saveCreateLinkedField(templateFieldId: string, config: GlobalBannerConfig): Promise<PropertyField> {
    return Client4.createPropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, {
        name: CLASSIFICATIONS_SYSTEM_FIELD_NAME,
        type: 'rank' as PropertyField['type'],
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
    return Client4.patchPropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, linkedFieldId, {
        attrs: {
            actions: placementToActions(config),
        },
    } as Partial<PropertyField>);
}

export async function saveDeleteLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, fieldId);
}

// --- System classification property value API ---

/**
 * Fetches the currently stored option ID for the system classification level.
 * Uses the dedicated system values endpoint (no target_id in URL).
 */
export async function fetchSystemClassificationValue(linkedFieldId: string): Promise<string | undefined> {
    const values = await Client4.getSystemPropertyValues<string>(CLASSIFICATIONS_GROUP_NAME);
    const match = ((values as Array<PropertyValue<string>>) ?? []).find((v) => v.field_id === linkedFieldId);
    return match?.value;
}

/**
 * Upserts the system classification property value to the given option ID and
 * banner actions. For classification, the value is the home for actions: the
 * webapp reads them from value.attrs.actions. The caller also mirrors them onto
 * the field, which mobile reads; that mirror can be removed once every client
 * reads actions from the value. Uses the dedicated system values endpoint
 * (sentinel target_id 'system'). Returns the saved values for eager store update.
 */
export async function saveUpsertSystemValue(linkedFieldId: string, optionId: string, actions: string[]): Promise<Array<PropertyValue<string>>> {
    return Client4.patchSystemPropertyValues<string>(CLASSIFICATIONS_GROUP_NAME, [
        {field_id: linkedFieldId, value: optionId, attrs: {actions}},
    ]);
}

// --- Channel field API (drives per-channel banners) ---

export async function fetchChannelClassificationField(): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields( // eslint-disable-line no-await-in-loop
            CLASSIFICATIONS_GROUP_NAME,
            CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_ID,
            {cursorId, cursorCreateAt},
        );
        const found = fields.find((f: PropertyField) => f.name === CLASSIFICATIONS_CHANNEL_FIELD_NAME && f.delete_at === 0 && f.linked_field_id);
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

export async function saveCreateChannelLinkedField(templateFieldId: string): Promise<PropertyField> {
    return Client4.createPropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, {
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: 'rank' as PropertyField['type'],
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        linked_field_id: templateFieldId,
        permission_field: 'admin',
        permission_values: 'admin',
        permission_options: 'admin',
    });
}

export async function saveDeleteChannelLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(CLASSIFICATIONS_GROUP_NAME, CLASSIFICATIONS_CHANNEL_OBJECT_TYPE, fieldId);
}
