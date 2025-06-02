// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import MultiValueSelector from './multi_value_selector_menu';
import SingleValueSelector from './single_value_selector_menu';

export interface TableRow {
    attribute: string;
    operator: string;
    values: string[];
}

export interface ValueSelectorMenuProps {
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;
}

// Main ValueSelectorMenu component that delegates to the appropriate selector
const ValueSelectorMenu = ({
    row,
    disabled,
    updateValues,
    options = [],
    allowCreateValue = false,
    placeholder,
}: ValueSelectorMenuProps) => {
    const isMultiOperator = row.operator === 'in';

    if (isMultiOperator) {
        return (
            <MultiValueSelector
                values={row.values}
                disabled={disabled}
                updateValues={updateValues}
                options={options}
                allowCreateValue={allowCreateValue}
                placeholder={placeholder}
            />
        );
    }

    // For single-value operators
    return (
        <SingleValueSelector
            value={row.values[0] || ''}
            disabled={disabled}
            updateValue={(value) => updateValues([value])}
            options={options}
            allowCreateValue={allowCreateValue}
            placeholder={placeholder}
        />
    );
};

export default ValueSelectorMenu;
