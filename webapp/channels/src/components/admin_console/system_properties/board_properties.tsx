// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import type {PropertyField} from '@mattermost/types/properties';

import {AttributesPanel} from './attributes_panel';
import {boardPropertyFieldConfig} from './board_properties_config';
import {BoardPropertiesTable} from './board_properties_table';

import type {SearchableStrings} from '../types';

export default function BoardProperties() {
    return (
        <AttributesPanel<PropertyField>
            group_id={boardPropertyFieldConfig.group_id}
            title={{
                id: 'admin.system_properties.board_properties.title',
                defaultMessage: 'Configure board attributes',
            }}
            subtitle={{
                id: 'admin.system_properties.board_properties.subtitle',
                defaultMessage: 'Customize the attributes available by default in cards across all boards.',
            }}
            dataTestId='board_properties'
            fieldConfig={boardPropertyFieldConfig}
            pageTitle={msg.pageTitle}
            renderTable={(tableProps) => (
                <BoardPropertiesTable
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
    pageTitle: {id: 'admin.sidebar.board_attributes', defaultMessage: 'Board Attributes'},
});

export const searchableStrings: SearchableStrings = Object.values(msg);
