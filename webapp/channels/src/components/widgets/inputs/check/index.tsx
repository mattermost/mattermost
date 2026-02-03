// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import './check.scss';

type Props = {
    id: string;
    ariaLabel: string;
    name: string;
    text: ReactNode;
    onChange: () => void;
    checked: boolean;
}

function CheckInput(props: Props) {
    const {id, ariaLabel, text, ...rest} = props;

    return (
        <div className='check-input'>
            <input
                {...rest}
                id={id}
                aria-label={ariaLabel}
                data-testid={id}
                type='checkbox'
            />
            <label
                className='text'
                htmlFor={id}
            >
                <span>{text}</span>
            </label>
        </div>
    );
}

export default CheckInput;
