// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import './selectPropertyRenderer.scss';

const DEFAULT_BACKGROUND_COLOR = 'light_gray';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
};

export default function SelectPropertyRenderer({field, value}: Props) {
    const options = (field as SelectPropertyField).attrs?.options;

    // Match the option id first, falling back to its name.
    const valueConfig = options?.find((option) => option.id === value.value) ??
        options?.find((option) => option.name === value.value);

    const {backgroundColor, color} = getOptionColors(valueConfig?.color || DEFAULT_BACKGROUND_COLOR);

    return (
        <div
            className='SelectProperty'
            data-testid='select-property'
            style={{
                backgroundColor,
                color,
            }}
        >
            {valueConfig?.name ?? (value.value as string)}
        </div>
    );
}

function getOptionColors(colorName: string): {backgroundColor: string; color: string} {
    switch (colorName) {
    case 'light_blue':
        return {
            backgroundColor: 'var(--sidebar-text-active-border)',
            color: '#FFF',
        };
    case 'dark_blue':
        return {
            backgroundColor: 'rgba(var(--sidebar-text-active-border-rgb), 0.92)',
            color: '#FFF',
        };
    case 'dark_red':
        return {
            backgroundColor: 'var(--error-text)',
            color: '#FFF',
        };
    case 'light_grey':
        return {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        };
    default:
        return {
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        };
    }
}
