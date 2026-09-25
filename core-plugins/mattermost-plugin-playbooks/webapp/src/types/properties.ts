// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Types that match the actual HTTP API response structure for properties

import type {
    FieldVisibility,
    PropertyField as PropertyFieldBase,
    PropertyFieldOption,
    PropertyValue as PropertyValueBase,
} from '@mattermost/types/properties';

export type PropertyField = PropertyFieldBase & {
    target_type: 'playbook' | 'run';
    attrs: {
        visibility: FieldVisibility;
        sort_order: number;
        options: PropertyFieldOption[] | null;
        parent_id?: string;
        value_type?: string;
    };
};

export type PropertyValue = PropertyValueBase<string | string[]> & {
    field_id: string;
}

export enum PropertyFieldType {
    Date = 'date',
    Multiselect = 'multiselect',
    Multiuser = 'multiuser',
    Select = 'select',
    Text = 'text',
    User = 'user'
}

export type PropertyOptionInput = {
    id?: string;
    name: string;
    color?: string;
};

export type PropertyFieldAttrsInput = {
    visibility?: FieldVisibility;
    sort_order?: number;
    options?: PropertyOptionInput[];
    parent_id?: string;
    value_type?: string;
};

export type PropertyFieldInput = {
    name: string;
    type: PropertyField['type'];
    attrs?: PropertyFieldAttrsInput;
};
