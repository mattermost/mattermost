// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './separator.scss';
import './notification-separator.scss';

type Props = {
    children?: React.ReactNode;
    testId?: string;
};

const NotificationSeparator = ({children, testId}: Props) => {
    return (
        <div
            className='Separator NotificationSeparator'
            data-testid={testId ?? 'NotificationSeparator'}
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

export default React.memo(NotificationSeparator);

