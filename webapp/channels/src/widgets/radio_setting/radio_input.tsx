// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ReactNode} from 'react';

import './radio_input.scss';

type Props = {
    id: string;
    dataTestId?: string;
    title: ReactNode;
    name: string;
    value?: string;
    checked?: boolean;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
}

export default function RadioInput({id, value, name, title, dataTestId, checked, handleChange, disabled}: Props) {
    return (
        <label
            className='RadioInput'
        >
            <input
                id={id}
                data-testid={dataTestId}
                type='radio'
                name={name}
                checked={checked}
                value={value || ''}
                onChange={handleChange}
                disabled={disabled}
            />
            {title}
        </label>
    );
}
