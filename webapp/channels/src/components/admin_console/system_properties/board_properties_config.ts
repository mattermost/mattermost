// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import type {PropertyFieldConfig} from './attributes_panel';
import {isCreatePending, isDeletePending} from './board_properties_utils';

export const boardPropertyFieldConfig: PropertyFieldConfig<PropertyField> = {
    group_id: 'board_attributes',
    getFields: async () => {
        const data = await Client4.getBoardAttributeFields();
        return data;
    },
    createField: async (field: Partial<PropertyField>) => {
        const {name, type, attrs} = field as PropertyField;
        if (!name || !type) {
            throw new Error('Name and type are required');
        }
        return Client4.createBoardAttributeField({name, type, attrs: attrs || {}});
    },
    patchField: async (id: string, patch: Partial<PropertyField>) => {
        const {name, type, attrs} = patch;
        let finalPatch: Partial<PropertyField> = {name, type, attrs};

        // Clear options if not select/multiselect
        if (type !== 'select' && type !== 'multiselect') {
            const attrs = {...finalPatch.attrs};
            if (attrs) {
                Reflect.deleteProperty(attrs, 'options');
                finalPatch = {...finalPatch, attrs};
            }
        }

        return Client4.patchBoardAttributeField(id, finalPatch);
    },
    deleteField: async (id: string) => {
        await Client4.deleteBoardAttributeField(id);
    },
    isCreatePending,
    isDeletePending,
    prepareFieldForCreate: (field: Partial<PropertyField>) => {
        const attrs = {...field.attrs};
        if (attrs?.options) {
            // Clear option ids
            attrs.options = (attrs.options as Array<{id?: string; name: string}>).map((option) => ({...option, id: ''}));
        }
        return {
            ...field,
            attrs: {
                sort_order: 0,
                ...attrs,
            },
        };
    },
    prepareFieldForPatch: (field: Partial<PropertyField>) => {
        const {name, type, attrs} = field;
        let patch: Partial<PropertyField> = {name, type, attrs};

        // Clear options if not select/multiselect
        if (type !== 'select' && type !== 'multiselect') {
            const attrs = {...patch.attrs};
            if (attrs) {
                Reflect.deleteProperty(attrs, 'options');
                patch = {...patch, attrs};
            }
        }

        return patch;
    },
};
