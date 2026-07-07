// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import MultiValueSelector from './multi_value_selector_menu';
import SingleValueSelector from './single_value_selector_menu';

import {isMultiValueOperator} from '../shared';

export interface TableRow {
    attribute: string;
    operator: string;
    values: string[];
    attribute_type: string;
    hasMaskedValues: boolean;

    // Native user attributes are referenced as `user.<name>` (vs `user.attributes.<name>`).
    isNative?: boolean;

    // Native boolean attributes (e.g. user.verified) emit unquoted true/false literals.
    isBoolean?: boolean;
}

export interface ValueSelectorMenuProps {
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;
}

const ValueSelectorMenu = ({
    row,
    disabled,
    updateValues,
    options = [],
    allowCreateValue = false,
    placeholder,
}: ValueSelectorMenuProps) => {
    const isMultiOperator = isMultiValueOperator(row.operator);

    if (isMultiOperator) {
        return (
            <MultiValueSelector
                values={row.values}
                disabled={disabled}
                updateValues={updateValues}
                options={options}
                allowCreateValue={allowCreateValue}
                placeholder={placeholder}
                hasMaskedValues={row.hasMaskedValues}
            />
        );
    }

    return (
        <SingleValueSelector
            value={row.values[0] || ''}
            disabled={disabled}
            updateValue={(value) => updateValues([value])}
            options={options}
            allowCreateValue={allowCreateValue}
            placeholder={placeholder}
            hasMaskedValues={row.hasMaskedValues}
        />
    );
};

export default ValueSelectorMenu;
