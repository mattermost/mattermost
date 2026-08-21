// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import styled from 'styled-components';

import {StyledSelect} from 'src/components/backstage/styles';

interface SelectOption {
    value: string;
    label: string;
}

interface Props {
    options: SelectOption[];
    initialValue?: string | string[];
    onValueChange?: (value: string | string[] | null) => void;
    onBlur?: () => void;
    isMulti?: boolean;
}

const PropertySelectInput = (props: Props) => {
    const [selectedOption, setSelectedOption] = useState<SelectOption | SelectOption[] | null>(null);

    // Initialize selected option from initial value
    useEffect(() => {
        if (props.initialValue) {
            if (props.isMulti && Array.isArray(props.initialValue)) {
                // For multiselect, find all matching options
                const matchingOptions = props.initialValue
                    .map((value) => props.options.find((option) => option.value === value))
                    .filter(Boolean) as SelectOption[];
                setSelectedOption(matchingOptions);
            } else if (!props.isMulti && typeof props.initialValue === 'string') {
                // For single select, find the matching option
                const matchingOption = props.options.find((option) => option.value === props.initialValue);
                if (matchingOption) {
                    setSelectedOption(matchingOption);
                }
            }
        } else {
            setSelectedOption(props.isMulti ? [] : null);
        }
    }, [props.initialValue, props.options, props.isMulti]);

    const handleSelectChange = (option: SelectOption | SelectOption[] | null) => {
        setSelectedOption(option);

        if (props.isMulti && Array.isArray(option)) {
            // For multiselect, extract the values as an array
            const values = option.map((opt) => opt.value);
            props.onValueChange?.(values.length > 0 ? values : null);
        } else if (!props.isMulti && option && !Array.isArray(option)) {
            // For single select, extract the single value and close the select
            props.onValueChange?.(option.value);
            props.onBlur?.();
        } else {
            props.onValueChange?.(null);
            props.onBlur?.();
        }
    };

    return (
        <SelectWrapper>
            <StyledSelect
                options={props.options}
                value={selectedOption}
                onChange={handleSelectChange}
                onBlur={props.onBlur}
                placeholder={props.isMulti ? 'Select options...' : 'Select option...'}
                isClearable={true}
                isMulti={props.isMulti}
                classNamePrefix='property-select'
                autoFocus={true}
                defaultMenuIsOpen={true}
                closeMenuOnSelect={!props.isMulti}
            />
        </SelectWrapper>
    );
};

const SelectWrapper = styled.div`
    flex: 1;
`;

export default PropertySelectInput;