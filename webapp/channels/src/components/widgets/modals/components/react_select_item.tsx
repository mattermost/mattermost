// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import type {OnChangeValue} from 'react-select';
import ReactSelect from 'react-select';

import {formatAsString} from 'utils/i18n';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type Option = {
    value: string;
    label: string | MessageDescriptor;
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
    handleChange: (selected: OnChangeValue<Option, boolean>) => void;
}

// Function to extract text from MessageDescriptor or return string as-is
export const getOptionLabel = (option: Option, intl: ReturnType<typeof useIntl>): string => {
    return formatAsString(intl.formatMessage, option.label) || '';
};

function ReactSelectItemCreator({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
}: Props): JSX.Element {
    const intl = useIntl();
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
                isClearable={inputFieldData.clearable}
                isSearchable={false}
                onChange={handleChange}
                value={inputFieldValue}
                components={{IndicatorSeparator: NoIndicatorSeparatorComponent}}
                getOptionLabel={(option) => getOptionLabel(option, intl)}

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
