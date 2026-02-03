// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField, UserPropertyFieldPatch} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {isCreatePending, isDeletePending} from './user_properties_utils';
import type {PropertyFieldConfig} from './attributes_panel';

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
        const {name, type, attrs} = patch as UserPropertyFieldPatch;
        let finalPatch: UserPropertyFieldPatch = {name, type, attrs};

        // Clear options if not select/multiselect
        if (type !== 'select' && type !== 'multiselect') {
            const attrs = {...finalPatch.attrs};
            Reflect.deleteProperty(attrs, 'options');
            finalPatch = {...finalPatch, attrs};
        }

        return Client4.patchCustomProfileAttributeField(id, finalPatch);
    },
    deleteField: async (id: string) => {
        return Client4.deleteCustomProfileAttributeField(id);
    },
    isCreatePending,
    isDeletePending,
    prepareFieldForCreate: (field: Partial<UserPropertyField>) => {
        const attrs = {...field.attrs};
        if (attrs?.options) {
            // Clear option ids
            attrs.options = attrs.options.map((option) => ({...option, id: ''}));
        }
        // Clear ldap/saml links
        Reflect.deleteProperty(attrs, 'ldap');
        Reflect.deleteProperty(attrs, 'saml');
        return {
            ...field,
            attrs: {
                visibility: 'when_set',
                sort_order: 0,
                value_type: '',
                ...attrs,
            },
        };
    },
    prepareFieldForPatch: (field: Partial<UserPropertyField>) => {
        const {name, type, attrs} = field;
        let patch: UserPropertyFieldPatch = {name, type, attrs};

        // Clear options if not select/multiselect
        if (type !== 'select' && type !== 'multiselect') {
            const attrs = {...patch.attrs};
            Reflect.deleteProperty(attrs, 'options');
            patch = {...patch, attrs};
        }

        return patch;
    },
};
