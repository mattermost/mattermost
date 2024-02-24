// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type FieldsetCheckbox = {
    dataTestId?: string;
    title: MessageDescriptor;
    name: string;
}

type Props = BaseSettingItemProps & {
    inputFieldData: FieldsetCheckbox;
    inputFieldValue: boolean;
    handleChange: (e: boolean) => void;
    className?: string;
    descriptionAboveContent?: boolean;
}
function CheckboxSettingItem({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
    className,
    descriptionAboveContent = false,
}: Props): JSX.Element {
    const content = (
        <fieldset
            key={inputFieldData.name}
            className='mm-modal-generic-section-item__fieldset-checkbox-ctr'
        >
            <label className='mm-modal-generic-section-item__fieldset-checkbox'>
                <input
                    className='mm-modal-generic-section-item__input-checkbox'
                    data-testid={inputFieldData.dataTestId}
                    type='checkbox'
                    name={inputFieldData.name}
                    checked={inputFieldValue}
                    onChange={(e) => handleChange(e.target.checked)}
                />
                <FormattedMessage
                    id={inputFieldData.title.id}
                    defaultMessage={inputFieldData.title.defaultMessage}
                />
            </label>
            <br/>
        </fieldset>
    );
    return (
        <BaseSettingItem
            content={content}
            title={title}
            description={description}
            className={className}
            descriptionAboveContent={descriptionAboveContent}
        />
    );
}

export default CheckboxSettingItem;
