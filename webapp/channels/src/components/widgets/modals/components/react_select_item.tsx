// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import type {OnChangeValue} from 'react-select';

import {Select} from '@mattermost/compass-ui/components/select';

import {formatAsString} from 'utils/i18n';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type SelectOption = {
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
    options: SelectOption[];
};

type Props = BaseSettingItemProps & {
    inputFieldData: FieldsetReactSelect;
    inputFieldValue: SelectOption;
    handleChange: (selected: OnChangeValue<SelectOption, boolean>) => void;
};

// Function to extract text from MessageDescriptor or return string as-is
export const getOptionLabel = (option: SelectOption, intl: ReturnType<typeof useIntl>): string => {
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

    const compassOptions = useMemo(() => {
        return inputFieldData.options.map((option) => ({
            value: option.value,
            label: getOptionLabel(option, intl),
        }));
    }, [inputFieldData.options, intl]);

    const onSelectChange = useCallback((value: string) => {
        const selected = inputFieldData.options.find((option) => option.value === value);
        if (selected) {
            handleChange(selected);
        }
    }, [handleChange, inputFieldData.options]);

    const content = (
        <fieldset className='mm-modal-generic-section-item__fieldset-react-select'>
            <Select
                id={inputFieldData.id}
                name={inputFieldData.name}
                options={compassOptions}
                onChange={onSelectChange}
                value={inputFieldValue.value}
                aria-label={inputFieldData.ariaLabelledby ? undefined : getOptionLabel(inputFieldValue, intl)}
                listboxLabel={inputFieldData.ariaLabelledby ? undefined : getOptionLabel(inputFieldValue, intl)}
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
