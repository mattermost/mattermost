// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import {Select} from '@mattermost/compass-ui/components/select';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';
import type {FieldsetCheckbox} from './checkbox_setting_item';
import {getOptionLabel, type FieldsetReactSelect, type SelectOption} from './react_select_item';

type Props = BaseSettingItemProps & {
    containerClassName?: string;
    descriptionAboveContent?: boolean;
    checkboxFieldTitle: ReactNode;
    checkboxFieldData: FieldsetCheckbox;
    checkboxFieldValue: boolean;
    handleCheckboxChange: (e: boolean) => void;
    selectFieldData: FieldsetReactSelect;
    selectFieldValue?: SelectOption;
    handleSelectChange: (selected: OnChangeValue<SelectOption, boolean>) => void;
    isSelectDisabled?: boolean;
    selectPlaceholder?: string;
};

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
    const intl = useIntl();

    const compassOptions = useMemo(() => {
        return selectFieldData.options.map((option) => ({
            value: option.value,
            label: getOptionLabel(option, intl),
        }));
    }, [intl, selectFieldData.options]);

    const onSelectChange = useCallback((value: string) => {
        const selected = selectFieldData.options.find((option) => option.value === value);
        if (selected) {
            handleSelectChange(selected);
        }
    }, [handleSelectChange, selectFieldData.options]);

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
                <Select
                    id={selectFieldData.id}
                    options={compassOptions}
                    disabled={isSelectDisabled}
                    placeholder={selectPlaceholder}
                    onChange={onSelectChange}
                    value={selectFieldValue?.value}
                    listboxLabel={selectFieldData.ariaLabelledby}
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
