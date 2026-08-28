// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import MultiValueSelector from './multi_value_selector_menu';
import SingleValueSelector from './single_value_selector_menu';

import {isMultiValueOperator} from '../shared';

export interface TableRow {
    attribute: string;

    // 'user' | 'session'; drives the CEL namespace. Defaults to user.
    attribute_object_type?: string;
    operator: string;
    values: string[];
    attribute_type: string;
    hasMaskedValues: boolean;

    // When set, the right-hand side of the condition is the accessed channel's
    // attribute (resource.attributes.<targetAttribute>) rather than a literal
    // value; `values` is then ignored. Only meaningful for comparison operators
    // and the multiselect list operators (has any of / has all of). The left
    // side stays the requesting user's attribute.
    targetAttribute?: string;

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

    // Comparable channel attributes offered as the right-hand side alongside
    // literal values (the consolidated VALUES + CHANNEL ATTRIBUTES dropdown).
    // Empty/undefined when the operator or attribute type has no target. When
    // one is picked, the row switches to a resource.attributes.<name> target.
    channelFields?: UserPropertyField[];
    onSelectTarget?: (name: string) => void;
}

const ValueSelectorMenu = ({
    row,
    disabled,
    updateValues,
    options = [],
    allowCreateValue = false,
    placeholder,
    channelFields = [],
    onSelectTarget,
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
                channelFields={channelFields}
                targetAttribute={row.targetAttribute}
                onSelectTarget={onSelectTarget}
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
            channelFields={channelFields}
            targetAttribute={row.targetAttribute}
            onSelectTarget={onSelectTarget}
        />
    );
};

export default ValueSelectorMenu;
