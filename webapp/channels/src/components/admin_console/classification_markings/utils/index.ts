// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import type {ClassificationLevel} from './presets';
import {PRESET_CUSTOM, presets} from './presets';

export const GROUP_NAME = 'custom_profile_attributes';

// OBJECT_TYPE is 'template' so the classification field acts as the canonical schema
// (a Linked Properties template). Per-channel fields will link to it and inherit its options.
export const OBJECT_TYPE = 'template';
export const TARGET_TYPE = 'system';

// TARGET_ID is intentionally empty for system-scoped fields — the target is the whole system,
// not a specific entity. The Client4 helper skips the target_id query param when it's empty.
export const TARGET_ID = '';
export const FIELD_NAME = 'classification';

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

export function processClassificationField(field: PropertyField): {levels: ClassificationLevel[]; presetId: string} {
    const options = (field.attrs?.options as PropertyFieldOption[]) || [];
    const levels = optionsToLevels(options);
    const presetId = detectPreset(levels);
    return {levels, presetId};
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
