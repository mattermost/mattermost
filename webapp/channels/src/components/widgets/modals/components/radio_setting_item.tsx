// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';

export type FieldsetRadio = {
    options: Array<{
        dataTestId?: string;
        title: ReactNode;
        name: string;
        key: string;
        value: string;
        suffix?: JSX.Element;
    }>;
}

type Props = BaseSettingItemProps & {
    className?: string;
    inputFieldData: FieldsetRadio;
    inputFieldValue: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function RadioSettingItem({
    title,
    description,
    className,
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
                {option.title}
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
            className={className}
            content={content}
            title={title}
            description={description}
        />
    );
}

export default RadioSettingItem;
