// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type FieldsetCheckbox = {
    dataTestId?: string;
    name: string;
}

type Props = BaseSettingItemProps & {
    inputFieldData: FieldsetCheckbox;
    inputFieldValue: boolean;

    /**
     * The title of the checkbox input field, pass in FormattedMessage component for styling compatibility
     */
    inputFieldTitle: ReactNode;
    handleChange: (e: boolean) => void;
    className?: string;
    descriptionAboveContent?: boolean;
}

export default function CheckboxSettingItem({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    inputFieldTitle,
    handleChange,
    className,
    descriptionAboveContent = false,
}: Props) {
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
                {inputFieldTitle}
            </label>
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
