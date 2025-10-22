// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import type {BaseSettingItemProps} from './base_setting_item';
import BaseSettingItem from './base_setting_item';
import RadioInput from "widgets/radio_setting/radio_input";

export type FieldsetRadio = {
    options: Array<{
        dataTestId?: string;
        title: ReactNode;
        name: string;
        key: string;
        value: string;
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
    dataTestId,
}: Props): JSX.Element {
    const fields = inputFieldData.options.map((option) => {
        return (
            <RadioInput
                key={option.key}
                id={option.name}
                dataTestId={option.dataTestId}
                name={option.name}
                value={option.value}
                title={option.title}
                checked={option.value === inputFieldValue}
                handleChange={handleChange}
            />
        );
    });

    const content = (
        <fieldset
            className='mm-modal-generic-section-item__fieldset-radio'
        >
            <legend className='hidden-label'>
                {title}
            </legend>
            {[...fields]}
        </fieldset>
    );
    return (
        <BaseSettingItem
            dataTestId={dataTestId}
            className={className}
            content={content}
            title={title}
            description={description}
        />
    );
}

export default RadioSettingItem;
