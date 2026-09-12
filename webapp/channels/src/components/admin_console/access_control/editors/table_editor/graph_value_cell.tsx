// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {PolicyHierarchicalValues} from 'components/property_fields/hierarchical_value_menu';

import {channelAttributeMenuItems} from './channel_attribute_target';
import MaskedChip from './masked_chip';
import type {TableRow} from './value_selector_menu';

export type GraphValueCellProps = {
    field: UserPropertyField;
    row: TableRow;
    disabled: boolean;

    updateValues: (values: string[]) => void;
    placeholder?: string;
    channelFields?: UserPropertyField[];
    onSelectTarget?: (name: string) => void;
    rowIndex?: number;
};

export default function GraphValueCell({
    field,
    row,
    disabled,
    updateValues,
    placeholder,
    channelFields = [],
    onSelectTarget,
    rowIndex = 0,
}: GraphValueCellProps) {
    const {formatMessage} = useIntl();

    return (
        <PolicyHierarchicalValues
            field={{
                id: field.id,
                object_type: field.object_type,
                type: field.type,

                // Pass attrs through: `options: field.attrs?.options ?? []` would
                // allocate a new array every render and re-join the hierarchy.
                attrs: field.attrs,
            }}
            names={row.values}
            onNamesChange={updateValues}
            disabled={disabled}
            menuId={`value-selector-menu-${rowIndex}`}
            buttonId={`value-selector-button-${rowIndex}`}
            buttonDataTestId='valueSelectorMenuButton'
            placeholder={placeholder}
            className='values-editor'
            trailingChips={row.hasMaskedValues ? <MaskedChip/> : undefined}
            extraMenuItems={onSelectTarget ? channelAttributeMenuItems(channelFields, row.targetAttribute, onSelectTarget, formatMessage) : undefined}
        />
    );
}
