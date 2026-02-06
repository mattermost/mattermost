// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import type {PropertyFieldConfig} from './attributes_panel';
import {isCreatePending, isDeletePending} from './board_properties_utils';
import {clearOptionIDs, prepareFieldForPatch} from './property_field_option_utils';

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
        const sanitizedPatch = prepareFieldForPatch(patch);
        return Client4.patchBoardAttributeField(id, sanitizedPatch);
    },
    deleteField: async (id: string) => {
        await Client4.deleteBoardAttributeField(id);
    },
    isCreatePending,
    isDeletePending,
    prepareFieldForCreate: (field: Partial<PropertyField>) => {
        const fieldWithClearedIDs = clearOptionIDs(field);
        return {
            ...fieldWithClearedIDs,
            attrs: {
                sort_order: 0,
                ...fieldWithClearedIDs.attrs,
            },
        };
    },
    prepareFieldForPatch,
};
