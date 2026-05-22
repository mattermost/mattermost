// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedObjects} from '../utilities';

export type FieldType = (
    'text' |
    'select' |
    'multiselect' |
    'date' |
    'user' |
    'multiuser'
);

export type PropertyField = {
    id: string;
    group_id: string;
    name: string;
    type: FieldType;
    attrs?: {
        subType?: string;
        [key: string]: unknown;
    };
    target_id: string;
    target_type: string;
    object_type: string;
    linked_field_id?: string;
    protected?: boolean;
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
    updated_by: string;
};

export type PropertyGroup = {
    id: string;
    name: string;
};

export type NameMappedPropertyFields = {[key: PropertyField['name']]: PropertyField};

export type PropertyValue<T> = {
    id: string;
    target_id: string;
    target_type: string;
    group_id: string;
    field_id: string;
    value: T;
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
    updated_by: string;
}

// `color` is free-form on the wire; consumers narrow it per feature
// (Boards: ColorToken, Classification Markings: hex, CPAs: '').
export type PropertyFieldOption<TColor extends string = string> = {
    id: string;
    name: string;
    color?: TColor;
}

export type SelectPropertyField = PropertyField & {
    attrs?: {
        editable?: boolean;
        options?: PropertyFieldOption[];
    };
}

export const supportsOptions = (field: PropertyField) => {
    return field.type === 'select' || field.type === 'multiselect';
};

// PSA v2 state types

export type PropertiesState = {
    fields: PropertyFieldsState;
    values: PropertyValuesState;
    groups: PropertyGroupsState;
};

export type PropertyFieldsState = {
    byObjectType: {
        [objectType: string]: {
            [groupId: string]: IDMappedObjects<PropertyField>;
        };
    };
    byId: IDMappedObjects<PropertyField>;
};

export type PropertyValuesState = {
    byTargetId: {
        [targetId: string]: {
            [fieldId: string]: PropertyValue<unknown>;
        };
    };
    byFieldId: {
        [fieldId: string]: {
            [targetId: string]: PropertyValue<unknown>;
        };
    };
};

export type PropertyGroupsState = {
    byId: IDMappedObjects<PropertyGroup>;
    byName: { [name: string]: PropertyGroup };
};

export type PropertyValuesUpdated<T> = {
    object_type?: string;
    target_id?: string;
    field_id?: string;
    values: Array<PropertyValue<T>>;
};
