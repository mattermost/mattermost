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
    'rank' |

    // A multi-valued select whose options form a hierarchy. Manage Attributes
    // create may write options (and parent edges) when PropertyFieldGraph is on.
    // Other editors (CPA, board attributes) still do not author them.
    'graph'
);

export type FieldVisibility = 'always' | 'hidden' | 'when_set';
export type FieldValueType =
    'email' |
    'url' |
    'phone' |
    '';

// Mirrors model/property_field.go. Empty means the server fills in the default
// for the field's object type.
export type PropertyPermissionLevel = 'none' | 'sysadmin' | 'admin' | 'member' | '';

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

    // The server is authoritative on all three; the client reads permission_values
    // only to decide whether to offer an editing affordance.
    permission_field?: PropertyPermissionLevel;
    permission_values?: PropertyPermissionLevel;
    permission_options?: PropertyPermissionLevel;
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

    // Names of parent options. Graph-only. Empty array marks a root. Omitting
    // the key on a graph write is a server no-op (leaves existing parents
    // unchanged); create must therefore send [] for roots.
    parents?: string[];

    // Reported by the options endpoints, never accepted on a write. True for an
    // option a field inherits from the template it links to.
    read_only?: boolean;

    // Reported by the options endpoints, never accepted on a write. Half of the
    // keyset cursor the options listing pages on, alongside the id. Absent when
    // zero, and zero is not a usable cursor value.
    create_at?: number;
};

export type SelectPropertyField = PropertyField & {
    attrs?: {
        editable?: boolean;

        /**
         * Absent both for a field with no options and for one whose list the
         * server declined to inline because the field has too many. In the
         * latter case `options_count` reports how many there are and
         * `options_omitted` is true; check it before treating an absent list as
         * "this field has no options".
         *
         * An editor that reads such a field holds no option list, so it must not
         * send one back: the server rejects a non-empty list on a field whose
         * options it withheld, because appending to the empty list the editor
         * was given would ask it to delete the rest. Sending no list, or an
         * empty one, leaves the options untouched and lets every other attr be
         * patched normally.
         */
        options?: PropertyFieldOption[];
        options_count?: number;
        options_omitted?: boolean;
    };
};

export const supportsOptions = (field: {type: FieldType}): boolean => {
    return field.type === 'select' || field.type === 'multiselect' || field.type === 'rank';
};

export const supportsHierarchy = (field: {type: FieldType}): boolean => field.type === 'graph';

// Whether a field's stored value is a list of option ids that has to be resolved
// against attrs.options before it is shown. supportsOptions answers a narrower
// question -- whether the plain option-list editor can write this field's options
// -- and excludes graph on purpose: a graph field's options carry parent links
// that editor has no way to send back.
export const valueRefersToOptions = (field: PropertyField) => {
    return supportsOptions(field) || supportsHierarchy(field);
};

export const isTextField = (field: PropertyField) => {
    return field.type === 'text';
};

// How a value may move once it is set, mirroring attrs.change_policy in
// model/property_field_attrs_validation.go. raise_only and lower_only compare
// option ranks, so the server strips them from any field that is not a rank.
export const PROPERTY_CHANGE_POLICIES = ['any', 'raise_only', 'lower_only', 'never'] as const;

export type PropertyChangePolicy = typeof PROPERTY_CHANGE_POLICIES[number];

export const ORDERED_PROPERTY_CHANGE_POLICIES: PropertyChangePolicy[] = ['raise_only', 'lower_only'];

export function isOrderedChangePolicy(policy: PropertyChangePolicy): boolean {
    return ORDERED_PROPERTY_CHANGE_POLICIES.includes(policy);
}

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
