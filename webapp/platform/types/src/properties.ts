// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IDMappedObjects} from './utilities';

export type FieldType = (
    'text' |
    'select' |
    'multiselect' |
    'date' |
    'user' |
    'multiuser' |
    'rank'
);

export type FieldVisibility = 'always' | 'hidden' | 'when_set';
export type FieldValueType =
    'email' |
    'url' |
    'phone' |
    '';

// PSAv2 access-level values. 'admin' resolves to the admin of the field's
// target (sysadmin for system targets, team admin for team targets, channel
// admin for channel targets) -- see server/public/model/property_field.go.
export type PermissionLevel = 'none' | 'sysadmin' | 'member' | 'admin';

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

    // PSAv2-only. permission_values is settable via the API for a linked
    // field (MM-69869's "Who can set the value") -- see
    // global_attributes/utils.ts. permission_field/permission_options remain
    // read-only from the webapp today.
    permission_field?: PermissionLevel;
    permission_values?: PermissionLevel;
    permission_options?: PermissionLevel;
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
};

/**
 * Base shape for a select/multiselect option. Features that constrain or
 * extend an option define their own type by aliasing this one.
 */
export type PropertyFieldOption = {
    id: string;
    name: string;
    color?: string;

    // Optional explicit ordering. When unset, consumers fall back to the
    // position of the option within `attrs.options`.
    rank?: number;
};

export type SelectPropertyField = PropertyField & {
    attrs?: {
        editable?: boolean;
        options?: PropertyFieldOption[];
    };
};

export const supportsOptions = (field: PropertyField) => {
    return field.type === 'select' || field.type === 'multiselect' || field.type === 'rank';
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
    byName: {[name: string]: PropertyGroup};
};

export type PropertyValuesUpdated<T> = {
    object_type?: string;
    target_id?: string;
    field_id?: string;
    values: Array<PropertyValue<T>>;
};
