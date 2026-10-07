// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import type {ReactNode} from 'react';
import React from 'react';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type FieldsetCheckbox = {
    dataTestId?: string;
    name: string;
};

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
};

export default function CheckboxSettingItem({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    inputFieldTitle,
    handleChange,
    className,
    dataTestId,
    descriptionAboveContent = false,
}: Props) {
    const checkboxId = inputFieldData.name.replaceAll(' ', '-');

    const content = (
        <div
            key={inputFieldData.name}
            className='mm-modal-generic-section-item__fieldset-checkbox-ctr'
        >
            <Checkbox
                className='mm-modal-generic-section-item__fieldset-checkbox'
                data-testid={inputFieldData.dataTestId}
                name={inputFieldData.name}
                id={checkboxId}
                checked={inputFieldValue}
                onChange={(e) => handleChange(e.target.checked)}
            >
                {inputFieldTitle}
            </Checkbox>
        </div>
    );

    return (
        <BaseSettingItem
            content={content}
            title={title}
            description={description}
            dataTestId={dataTestId}
            className={className}
            descriptionAboveContent={descriptionAboveContent}
        />
    );
}
