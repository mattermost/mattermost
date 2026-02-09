// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import Constants from 'utils/constants';

import {AttributesTable, type AttributesTableConfig} from './attributes_table';
import BoardPropertiesDotMenu from './board_properties_dot_menu';
import BoardPropertiesTypeMenu from './board_properties_type_menu';
import {isCreatePending, supportsOptions} from './board_properties_utils';

const ValidationWarningNameRequired = 'name_required';
const ValidationWarningNameUnique = 'name_unique';
const ValidationWarningNameTaken = 'name_taken';

const boardPropertiesTableConfig: AttributesTableConfig<PropertyField> = {
    i18n: {
        attribute: {
            id: 'admin.system_properties.board_properties.table.property',
            defaultMessage: 'Attribute',
        },
        type: {
            id: 'admin.system_properties.board_properties.table.type',
            defaultMessage: 'Type',
        },
        values: {
            id: 'admin.system_properties.board_properties.table.values',
            defaultMessage: 'Values',
        },
        actions: {
            id: 'admin.system_properties.board_properties.table.actions',
            defaultMessage: 'Actions',
        },
        addAttribute: {
            id: 'admin.system_properties.board_properties.add_property',
            defaultMessage: 'Add attribute',
        },
        nameRequired: {
            id: 'admin.system_properties.board_properties.table.validation.name_required',
            defaultMessage: 'Please enter an attribute name.',
        },
        nameUnique: {
            id: 'admin.system_properties.board_properties.table.validation.name_unique',
            defaultMessage: 'Attribute names must be unique.',
        },
        nameTaken: {
            id: 'admin.system_properties.board_properties.table.validation.name_taken',
            defaultMessage: 'Attribute name already taken.',
        },
        attributeNameInput: {
            id: 'admin.system_properties.board_properties.table.property_name.input.name',
            defaultMessage: 'Attribute Name',
        },
    },
    validationWarnings: {
        nameRequired: ValidationWarningNameRequired,
        nameUnique: ValidationWarningNameUnique,
        nameTaken: ValidationWarningNameTaken,
    },
    maxNameLength: Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH,
    renderActionsMenu: ({field, canCreate, createField, updateField, deleteField}) => (
        <BoardPropertiesDotMenu
            field={field}
            canCreate={canCreate}
            createField={createField}
            updateField={updateField}
            deleteField={deleteField}
        />
    ),
    renderTypeSelector: ({field, updateField}) => (
        <BoardPropertiesTypeMenu
            field={field}
            updateField={updateField}
        />
    ),
    isCreatePending,
    supportsOptions,
    tableId: 'boardProperties',
};

type Props = {
    data: import('@mattermost/types/utilities').IDMappedCollection<PropertyField>;
    canCreate: boolean;
    createField: (field: PropertyField) => void;
    updateField: (field: PropertyField) => void;
    deleteField: (id: string) => void;
    reorderField: (field: PropertyField, nextOrder: number) => void;
}

export function BoardPropertiesTable({
    data: collection,
    canCreate,
    createField,
    updateField,
    deleteField,
    reorderField,
}: Props) {
    return (
        <AttributesTable
            data={collection}
            canCreate={canCreate}
            createField={createField}
            updateField={updateField}
            deleteField={deleteField}
            reorderField={reorderField}
            config={boardPropertiesTableConfig}
        />
    );
}
