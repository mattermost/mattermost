// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {isCreatePending, isDeletePending} from './user_properties_utils';
import type {PropertyFieldConfig} from './attributes_panel';
import {clearOptionIDs, prepareFieldForPatch} from './property_field_option_utils';

export const userPropertyFieldConfig: PropertyFieldConfig<UserPropertyField> = {
    group_id: 'custom_profile_attributes',
    getFields: async () => {
        const data = await Client4.getCustomProfileAttributeFields();
        return data;
    },
    createField: async (field: Partial<UserPropertyField>) => {
        const {name, type, attrs} = field as UserPropertyField;
        if (!name || !type) {
            throw new Error('Name and type are required');
        }
        return Client4.createCustomProfileAttributeField({name, type, attrs: attrs || {}});
    },
    patchField: async (id: string, patch: Partial<UserPropertyField>) => {
        const sanitizedPatch = prepareFieldForPatch(patch);
        return Client4.patchCustomProfileAttributeField(id, sanitizedPatch as UserPropertyFieldPatch);
    },
    deleteField: async (id: string) => {
        return Client4.deleteCustomProfileAttributeField(id);
    },
    isCreatePending,
    isDeletePending,
    prepareFieldForCreate: (field: Partial<UserPropertyField>) => {
        const fieldWithClearedIDs = clearOptionIDs(field);
        const attrs = {...fieldWithClearedIDs.attrs};
        // Clear ldap/saml links (user properties specific)
        Reflect.deleteProperty(attrs, 'ldap');
        Reflect.deleteProperty(attrs, 'saml');
        return {
            ...fieldWithClearedIDs,
            attrs: {
                visibility: 'when_set',
                sort_order: 0,
                value_type: '',
                ...attrs,
            },
        };
    },
    prepareFieldForPatch,
};
