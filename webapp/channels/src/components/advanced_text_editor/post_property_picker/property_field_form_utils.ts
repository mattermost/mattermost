// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FieldType, PropertyField, PropertyFieldOption, PropertyFieldPatch} from '@mattermost/types/properties';

import type {NewPropertyData} from './new_property_form';

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect'];

export function fieldToFormData(field: PropertyField): NewPropertyData {
    const options = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? undefined;
    return {
        name: field.name,
        type: field.type,
        options,
    };
}

export function optionsEqual(a: PropertyFieldOption[], b: PropertyFieldOption[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) {
            return false;
        }
    }
    return true;
}

export function formDataEqualsInitial(data: NewPropertyData, initialValues: NewPropertyData): boolean {
    const trimmedName = data.name.trim();
    if (trimmedName !== initialValues.name.trim()) {
        return false;
    }
    if (data.type !== initialValues.type) {
        return false;
    }
    const initialOptions = initialValues.options ?? [];
    const nextOptions = data.options ?? [];
    if (TYPES_WITH_OPTIONS.includes(data.type) || TYPES_WITH_OPTIONS.includes(initialValues.type)) {
        return optionsEqual(initialOptions, nextOptions);
    }
    return true;
}

export function buildPropertyFieldPatch(field: PropertyField, data: NewPropertyData): PropertyFieldPatch | null {
    const patch: PropertyFieldPatch = {};
    const trimmedName = data.name.trim();

    if (trimmedName !== field.name) {
        patch.name = trimmedName;
    }
    if (data.type !== field.type) {
        patch.type = data.type;
    }

    const needsOptions = TYPES_WITH_OPTIONS.includes(data.type);
    const originalOptions = (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
    const newOptions = data.options ?? [];

    if (needsOptions) {
        const typeChanged = data.type !== field.type;
        const optionsChanged = !optionsEqual(originalOptions, newOptions);
        if (typeChanged || optionsChanged) {
            patch.attrs = {...(field.attrs ?? {}), options: newOptions};
        }
    } else if (TYPES_WITH_OPTIONS.includes(field.type)) {
        patch.attrs = {...(field.attrs ?? {}), options: []};
    }

    return Object.keys(patch).length > 0 ? patch : null;
}
