// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import type {ClassificationLevel} from './presets';
import {PRESET_CUSTOM, presets} from './presets';

export const GROUP_NAME = 'classification_markings';

// OBJECT_TYPE is 'template' so the classification field acts as the canonical schema
// (a Linked Properties template). Per-channel fields will link to it and inherit its options.
export const OBJECT_TYPE = 'template';
export const TARGET_TYPE = 'system';

// TARGET_ID is intentionally empty for system-scoped template fields.
export const TARGET_ID = '';
export const FIELD_NAME = 'classification';
export const LINKED_FIELD_NAME = 'system_classification';

// The linked field uses the 'system' object type introduced in #36250.
// System fields are canonicalized server-side: target_type='system', target_id=''.
// System values use the sentinel target_id 'system' and dedicated API routes.
export const LINKED_OBJECT_TYPE = 'system';

// System-scoped fields have target_id '' on the field definition.
export const SYSTEM_FIELD_TARGET_ID = '';

// The sentinel target_id used by the server for system-scoped property values.
export const SYSTEM_VALUE_TARGET_ID = 'system';

// Actions stored on the linked field's attrs.actions to control banner display.
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
        const fields = await Client4.getPropertyFields(GROUP_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID, {cursorId, cursorCreateAt}); // eslint-disable-line no-await-in-loop
        const found = fields.find((f: PropertyField) => f.name === FIELD_NAME && f.delete_at === 0);
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
    return Client4.createPropertyField(GROUP_NAME, OBJECT_TYPE, {
        name: FIELD_NAME,
        type: 'select' as PropertyField['type'],
        target_type: TARGET_TYPE,
        target_id: TARGET_ID,
        attrs: {options, managed: 'admin'},
        permission_field: 'sysadmin',
        permission_values: 'sysadmin',
        permission_options: 'sysadmin',
    });
}

export async function saveDeleteField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(GROUP_NAME, OBJECT_TYPE, fieldId);
}

export async function savePatchField(fieldId: string, levels: ClassificationLevel[]): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    return Client4.patchPropertyField(GROUP_NAME, OBJECT_TYPE, fieldId, {
        attrs: {options},
    } as Partial<PropertyField>);
}

// --- Linked system classification field API ---

export async function fetchLinkedClassificationField(): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields(GROUP_NAME, LINKED_OBJECT_TYPE, TARGET_TYPE, SYSTEM_FIELD_TARGET_ID, {cursorId, cursorCreateAt}); // eslint-disable-line no-await-in-loop
        const found = fields.find((f: PropertyField) => f.name === LINKED_FIELD_NAME && f.delete_at === 0 && f.linked_field_id);
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
    return Client4.createPropertyField(GROUP_NAME, LINKED_OBJECT_TYPE, {
        name: LINKED_FIELD_NAME,
        type: 'select' as PropertyField['type'],
        target_type: TARGET_TYPE,
        target_id: SYSTEM_FIELD_TARGET_ID,
        linked_field_id: templateFieldId,
        attrs: {
            actions: placementToActions(config),
        },
    });
}

export async function savePatchLinkedField(linkedFieldId: string, config: GlobalBannerConfig): Promise<PropertyField> {
    return Client4.patchPropertyField(GROUP_NAME, LINKED_OBJECT_TYPE, linkedFieldId, {
        attrs: {
            actions: placementToActions(config),
        },
    } as Partial<PropertyField>);
}

export async function saveDeleteLinkedField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(GROUP_NAME, LINKED_OBJECT_TYPE, fieldId);
}

// --- System classification property value API ---

/**
 * Fetches the currently stored option ID for the system classification level.
 * Uses the dedicated system values endpoint (no target_id in URL).
 */
export async function fetchSystemClassificationValue(linkedFieldId: string): Promise<string | undefined> {
    const values = await Client4.getSystemPropertyValues<string>(GROUP_NAME);
    const match = ((values as Array<PropertyValue<string>>) ?? []).find((v) => v.field_id === linkedFieldId);
    return match?.value;
}

/**
 * Upserts the system classification property value to the given option ID.
 * Uses the dedicated system values endpoint (sentinel target_id 'system').
 * Returns the saved property values so callers can eagerly update the store.
 */
export async function saveUpsertSystemValue(linkedFieldId: string, optionId: string): Promise<Array<PropertyValue<string>>> {
    return Client4.patchSystemPropertyValues<string>(GROUP_NAME, [
        {field_id: linkedFieldId, value: optionId},
    ]);
}
