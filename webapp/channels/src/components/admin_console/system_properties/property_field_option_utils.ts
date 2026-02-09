// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

/**
 * Clears option IDs from a field's options array.
 * Used when duplicating fields or preparing fields for creation,
 * as the server will assign new IDs.
 */
export function clearOptionIDs<T extends PropertyField>(field: Partial<T>): Partial<T> {
    const attrs = {...field.attrs} as {options?: Array<{id?: string; name: string}>; [key: string]: unknown};
    if (attrs?.options && Array.isArray(attrs.options)) {
        attrs.options = attrs.options.map((option: {id?: string; name: string}) => ({
            ...option,
            id: '',
        }));
    }
    return {
        ...field,
        attrs,
    };
}

/**
 * Clears the options attribute if the field type is not select or multiselect.
 * Used when changing field types to ensure invalid options are removed.
 */
export function clearOptionsIfNotSelect<T extends PropertyField>(field: Partial<T>): Partial<T> {
    const {name, type, attrs} = field;
    if (type !== 'select' && type !== 'multiselect') {
        const updatedAttrs = {...attrs};
        if (updatedAttrs) {
            Reflect.deleteProperty(updatedAttrs, 'options');
        }
        return {
            ...field,
            name,
            type,
            attrs: updatedAttrs,
        };
    }
    return field;
}

/**
 * Prepares a field for patch by clearing options if not select/multiselect.
 * This is a convenience function for use in prepareFieldForPatch configs.
 */
export function prepareFieldForPatch<T extends PropertyField>(field: Partial<T>): Partial<T> {
    return clearOptionsIfNotSelect(field);
}
