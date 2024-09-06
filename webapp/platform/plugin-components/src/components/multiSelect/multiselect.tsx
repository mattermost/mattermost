// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import type {GroupBase, MultiValue, SingleValue} from 'react-select';
import Select from 'react-select';
import type {SelectComponentsConfig} from 'react-select/dist/declarations/src/components';

import type {DropdownOption} from 'components/dropdown/dropdown';
export type CustomComponentsDefinition = SelectComponentsConfig<DropdownOption, true, GroupBase<DropdownOption>>

export type Props = {
    options: DropdownOption[];
    values?: DropdownOption[];
    customComponents?: CustomComponentsDefinition;
    onChange: (selectedValues: DropdownOption[]) => void;
}

function Multiselect({options, values, customComponents, onChange}: Props) {
    const onChangeHandler = useCallback((newValue: SingleValue<DropdownOption> | MultiValue<DropdownOption>) => {
        if (Array.isArray(newValue)) {
            onChange(newValue);
        }
    }, [onChange]);

    return (
        <Select
            isMulti={true}
            isClearable={false}
            value={values}
            options={options}
            components={customComponents}
            onChange={onChangeHandler}
        />
    );
}

export default Multiselect;
