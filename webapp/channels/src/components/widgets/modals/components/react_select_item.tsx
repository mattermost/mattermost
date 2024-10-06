// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import type {ValueType} from 'react-select';
import ReactSelect from 'react-select';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type Option = {
    value: string;
    label: ReactNode;
};

export type FieldsetReactSelect = {
    id: string;
    name?: string;
    inputId?: string;
    dataTestId?: string;
    ariaLabelledby?: string;
    clearable?: boolean;
    options: Option[];
}

type Props = BaseSettingItemProps & {
    inputFieldData: FieldsetReactSelect;
    inputFieldValue: Option;
    handleChange: (selected: ValueType<Option>) => void;
}

function ReactSelectItemCreator({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
}: Props): JSX.Element {
    const content = (
        <fieldset className='mm-modal-generic-section-item__fieldset-react-select'>
            <ReactSelect
                id={inputFieldData.id}
                name={inputFieldData.name}
                inputId={inputFieldData.inputId}
                aria-labelledby={inputFieldData.ariaLabelledby}
                className='react-select singleSelect react-select-top'
                classNamePrefix='react-select'
                options={inputFieldData.options}
                clearable={inputFieldData.clearable}
                isClearable={inputFieldData.clearable}
                isSearchable={false}
                onChange={handleChange}
                value={inputFieldValue}
                components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
            />
        </fieldset>
    );

    return (
        <BaseSettingItem
            content={content}
            title={title}
            description={description}
        />
    );
}

export default ReactSelectItemCreator;

function NoIndicatorSeparatorComponent() {
    return null;
}
