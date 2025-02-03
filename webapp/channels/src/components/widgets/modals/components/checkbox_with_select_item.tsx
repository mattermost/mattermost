// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import ReactSelect from 'react-select';
import type {ValueType} from 'react-select';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';
import type {FieldsetCheckbox} from './checkbox_setting_item';
import type {FieldsetReactSelect, Option} from './react_select_item';

type Props = BaseSettingItemProps & {
    containerClassName?: string;
    descriptionAboveContent?: boolean;
    checkboxFieldTitle: ReactNode;
    checkboxFieldData: FieldsetCheckbox;
    checkboxFieldValue: boolean;
    handleCheckboxChange: (e: boolean) => void;
    selectFieldData: FieldsetReactSelect;
    selectFieldValue?: Option;
    handleSelectChange: (selected: ValueType<Option>) => void;
    isSelectDisabled?: boolean;
    selectPlaceholder?: string;
}

export default function CheckboxWithSelectSettingItem({
    title,
    description,
    containerClassName,
    descriptionAboveContent = false,
    checkboxFieldTitle,
    checkboxFieldData,
    checkboxFieldValue,
    handleCheckboxChange,
    selectFieldData,
    selectFieldValue,
    handleSelectChange,
    isSelectDisabled,
    selectPlaceholder,
}: Props) {
    const content = (
        <>
            <fieldset
                key={checkboxFieldData.name}
                className='mm-modal-generic-section-item__fieldset-checkbox-ctr'
            >
                <label className='mm-modal-generic-section-item__fieldset-checkbox'>
                    <input
                        className='mm-modal-generic-section-item__input-checkbox'
                        data-testid={checkboxFieldData.dataTestId}
                        type='checkbox'
                        name={checkboxFieldData.name}
                        checked={checkboxFieldValue}
                        onChange={(e) => handleCheckboxChange(e.target.checked)}
                    />
                    {checkboxFieldTitle}
                </label>
            </fieldset>
            <fieldset className='mm-modal-generic-section-item__fieldset-react-select'>
                <ReactSelect
                    id={selectFieldData.id}
                    inputId={selectFieldData.inputId}
                    aria-labelledby={selectFieldData.ariaLabelledby}
                    className='react-select singleSelect react-select-top'
                    classNamePrefix='react-select'
                    options={selectFieldData.options}
                    clearable={selectFieldData.clearable}
                    isClearable={selectFieldData.clearable}
                    isDisabled={isSelectDisabled}
                    isSearchable={false}
                    placeholder={selectPlaceholder}
                    onChange={(value) => handleSelectChange(value)}
                    value={selectFieldValue}
                    components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                />
            </fieldset>
        </>
    );

    return (
        <BaseSettingItem
            title={title}
            content={content}
            isContentInline={true}
            description={description}
            className={containerClassName}
            descriptionAboveContent={descriptionAboveContent}
        />
    );
}

function NoIndicatorSeparatorComponent() {
    return null;
}

export type SelectOption = {
    value: string;
    label: ReactNode;
};
