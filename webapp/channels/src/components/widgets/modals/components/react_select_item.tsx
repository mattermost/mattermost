// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ValueType} from 'react-select';
import ReactSelect from 'react-select';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type Option = {
    value: number;
    label: string;
};

export type FieldsetReactSelect = {
    dataTestId?: string;
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
                className='react-select'
                classNamePrefix='react-select'
                id='limitVisibleGMsDMs'
                options={inputFieldData.options}
                clearable={false}
                onChange={handleChange}
                value={inputFieldValue}
                isSearchable={false}
                menuPortalTarget={document.body}
                styles={reactStyles}
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

const reactStyles = {
    menuPortal: (provided: React.CSSProperties) => ({
        ...provided,
        zIndex: 9999,
    }),
};
