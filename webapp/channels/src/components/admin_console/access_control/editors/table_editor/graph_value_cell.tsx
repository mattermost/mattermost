// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import {PolicyHierarchicalValues} from 'components/property_fields/hierarchical_value_menu';

import {channelAttributeMenuItems} from './channel_attribute_target';
import MaskedChip from './masked_chip';
import MultiValueSelector from './multi_value_selector_menu';
import type {TableRow} from './value_selector_menu';

const GRAPH_FLAG_OFF_EMPTY_OPTIONS: PropertyFieldOption[] = [
    {id: '__graph_omitted__', name: '\u200b'},
];

export type GraphValueCellProps = {
    field: UserPropertyField;
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
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
    options = [],
    placeholder,
    channelFields = [],
    onSelectTarget,
    rowIndex = 0,
}: GraphValueCellProps) {
    const {formatMessage} = useIntl();
    const graphTreeEnabled = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';

    const dropInert = useCallback((next: string[]) => {
        const filtered = next.filter((value) => value !== '\u200b');
        if (filtered.length === 0 && next.includes('\u200b')) {
            return;
        }
        updateValues(filtered);
    }, [updateValues]);

    if (graphTreeEnabled) {
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

    return (
        <MultiValueSelector
            values={row.values}
            disabled={disabled}
            updateValues={options.length > 0 ? updateValues : dropInert}
            options={options.length > 0 ? options : GRAPH_FLAG_OFF_EMPTY_OPTIONS}
            allowCreateValue={false}
            placeholder={placeholder}
            hasMaskedValues={row.hasMaskedValues}
            channelFields={channelFields}
            targetAttribute={row.targetAttribute}
            onSelectTarget={onSelectTarget}
        />
    );
}
