// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {supportsOptions, type UserPropertyField} from '@mattermost/types/properties';

import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';

import {AttributesTable, type AttributesTableConfig} from './attributes_table';
import {LinkButton} from './controls';
import type {SectionHook} from './section_utils';
import DotMenu from './user_properties_dot_menu';
import SelectType from './user_properties_type_menu';
import type {UserPropertyFields} from './user_properties_utils';
import {isCreatePending, useUserPropertyFields, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique} from './user_properties_utils';

export const useUserPropertiesTable = (): SectionHook => {
    const [userPropertyFields, readIO, pendingIO, itemOps] = useUserPropertyFields();
    const nonDeletedCount = Object.values(userPropertyFields.data).filter((f) => f.delete_at === 0).length;

    const canCreate = nonDeletedCount < Constants.MAX_CUSTOM_ATTRIBUTES;

    const create = () => {
        itemOps.create(undefined);
    };

    const save = async () => {
        const newData = await pendingIO.commit();

        // reconcile - zero pending changes
        if (newData && !newData.errors) {
            readIO.setData(newData);
        }
    };

    const content = readIO.loading ? (
        <LoadingScreen/>
    ) : (
        <>
            <UserPropertiesTable
                data={userPropertyFields}
                canCreate={canCreate}
                createField={itemOps.create}
                updateField={itemOps.update}
                deleteField={itemOps.delete}
                reorderField={itemOps.reorder}
            />
            {canCreate && (
                <LinkButton onClick={create}>
                    <PlusIcon size={16}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.add_property'
                        defaultMessage='Add attribute'
                    />
                </LinkButton>
            )}
        </>
    );

    return {
        content,
        loading: readIO.loading,
        hasChanges: pendingIO.hasChanges,
        isValid: !userPropertyFields.warnings,
        save,
        cancel: pendingIO.reset,
        saving: pendingIO.saving,
        saveError: pendingIO.error,
    };
};

type Props = {
    data: UserPropertyFields;
    canCreate: boolean;
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
    reorderField: (field: UserPropertyField, nextOrder: number) => void;
}

const userPropertiesTableConfig: AttributesTableConfig<UserPropertyField> = {
    i18n: {
        attribute: {
            id: 'admin.system_properties.user_properties.table.property',
            defaultMessage: 'Attribute',
        },
        type: {
            id: 'admin.system_properties.user_properties.table.type',
            defaultMessage: 'Type',
        },
        values: {
            id: 'admin.system_properties.user_properties.table.values',
            defaultMessage: 'Values',
        },
        actions: {
            id: 'admin.system_properties.user_properties.table.actions',
            defaultMessage: 'Actions',
        },
        addAttribute: {
            id: 'admin.system_properties.user_properties.add_property',
            defaultMessage: 'Add attribute',
        },
        nameRequired: {
            id: 'admin.system_properties.user_properties.table.validation.name_required',
            defaultMessage: 'Please enter an attribute name.',
        },
        nameUnique: {
            id: 'admin.system_properties.user_properties.table.validation.name_unique',
            defaultMessage: 'Attribute names must be unique.',
        },
        nameTaken: {
            id: 'admin.system_properties.user_properties.table.validation.name_taken',
            defaultMessage: 'Attribute name already taken.',
        },
        attributeNameInput: {
            id: 'admin.system_properties.user_properties.table.property_name.input.name',
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
        <DotMenu
            field={field}
            canCreate={canCreate}
            createField={createField}
            updateField={updateField}
            deleteField={deleteField}
        />
    ),
    renderTypeSelector: ({field, updateField}) => (
        <SelectType
            field={field}
            updateField={updateField}
        />
    ),
    isCreatePending,
    supportsOptions,
    tableId: 'userProperties',
};

export function UserPropertiesTable({
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
            config={userPropertiesTableConfig}
        />
    );
}

