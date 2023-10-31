// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage} from 'react-intl';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type FieldsetRadio = {
    options: Array<{
        dataTestId?: string;
        title: MessageDescriptor;
        name: string;
        key: string;
        value: string;
        suffix?: JSX.Element;
    }>;
}

type Props = BaseSettingItemProps & {
    inputFieldData: FieldsetRadio;
    inputFieldValue: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
function RadioSettingItem({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
}: Props): JSX.Element {
    const fields = inputFieldData.options.map((option) => {
        return (
            <label
                key={option.key}
                className='mm-modal-generic-section-item__label-radio'
            >
                <input
                    id={option.key}
                    data-testid={option.dataTestId}
                    type='radio'
                    name={option.name}
                    checked={option.value === inputFieldValue}
                    value={option.value}
                    onChange={handleChange}
                />
                <FormattedMessage
                    id={option.title.id}
                    defaultMessage={option.title.defaultMessage}
                />
                {option.suffix}
            </label>
        );
    });

    const content = (
        <fieldset className='mm-modal-generic-section-item__fieldset-radio'>
            {[...fields]}
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

export default RadioSettingItem;
