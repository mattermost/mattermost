// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties';

import {AttributesPanel} from './attributes_panel';
import {userPropertyFieldConfig} from './user_properties_config';
import {UserPropertiesTable} from './user_properties_table';

import type {SearchableStrings} from '../types';

export default function SystemProperties() {
    return (
        <AttributesPanel<UserPropertyField>
            group_id={userPropertyFieldConfig.group_id}
            title={{
                id: 'admin.system_properties.user_properties.title',
                defaultMessage: 'Configure user attributes',
            }}
            subtitle={{
                id: 'admin.system_properties.user_properties.subtitle',
                defaultMessage: 'Attributes will be shown in user profile and can be used in access control policies.',
            }}
            dataTestId='user_properties'
            fieldConfig={userPropertyFieldConfig}
            pageTitle={msg.pageTitle}
            renderTable={(tableProps) => (
                <UserPropertiesTable
                    data={tableProps.data}
                    canCreate={tableProps.canCreate}
                    createField={tableProps.createField}
                    updateField={tableProps.updateField}
                    deleteField={tableProps.deleteField}
                    reorderField={tableProps.reorderField}
                />
            )}
        />
    );
}

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.user_attributes', defaultMessage: 'User Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
