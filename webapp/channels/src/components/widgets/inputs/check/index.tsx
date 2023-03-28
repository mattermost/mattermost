// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { ReactNode } from 'react';
import './check.scss';

type Props = {
    id: string;
    name: string;
    text: ReactNode;
    onChange: () => void;
    checked: boolean;
}

function Check(props: Props) {
    return (
        <div className='check-input'>
            <input
                {...props}
                type='checkbox'
            />
            <span className='text'>{props.text}</span>
        </div>
    );
}

export default Check;
