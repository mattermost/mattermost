// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {StylesConfig} from 'react-select';

import type {ValueType} from 'components/dropdown_input';

/** react-select styles for classification preset: 34px height, 16px chevron inset (Figma). */
export const classificationPresetDropdownStyles: StylesConfig<ValueType> = {
    input: (provided) => ({
        ...provided,
        color: 'var(--center-channel-color)',
        margin: 0,
        paddingTop: 0,
        paddingBottom: 0,
    }),
    control: (provided, state) => ({
        ...provided,
        alignItems: 'center',
        minHeight: 34,
        height: 34,
        border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
        borderRadius: 'var(--radius-s)',
        boxShadow: 'none',
        cursor: state.isDisabled ? 'not-allowed' : 'pointer',
        paddingLeft: 12,
        paddingRight: 16,
        backgroundColor: 'var(--center-channel-bg)',
        opacity: state.isDisabled ? 0.64 : 1,
        ...(!state.isDisabled &&
            state.isFocused && {
            borderColor: 'var(--button-bg)',
            boxShadow: 'inset 0 0 0 1px var(--button-bg)',
        }),
    }),
    valueContainer: (provided) => ({
        ...provided,
        height: 32,
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 4,
    }),
    singleValue: (provided) => ({
        ...provided,
        lineHeight: '20px',
        marginLeft: 0,
        marginRight: 0,
    }),
    placeholder: (provided) => ({
        ...provided,
        lineHeight: '20px',
        margin: 0,
    }),
    indicatorsContainer: (provided) => ({
        ...provided,
        height: 32,
        padding: 0,
    }),
    indicatorSeparator: () => ({
        display: 'none',
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 100,
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 200,
    }),
};
