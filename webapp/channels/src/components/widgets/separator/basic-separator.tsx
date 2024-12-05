// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import './separator.scss';

type Props = {
    children?: ReactNode;
};

const BasicSeparator = ({children}: Props) => {
    return (
        <div
            data-testid='basicSeparator'
            className='Separator BasicSeparator'
        >
            <hr className='separator__hr'/>
            {children && (
                <div className='separator__text'>
                    {children}
                </div>
            )}
        </div>
    );
};

export default BasicSeparator;
