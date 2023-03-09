// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import './separator.scss';
import './notification-separator.scss';

export default class NotificationSeparator extends React.PureComponent<React.PropsWithChildren<any>> {
    public render() {
        const {children} = this.props;
        return (
            <div
                className='Separator NotificationSeparator'
                data-testid='NotificationSeparator'
            >
                <hr className='separator__hr'/>
                {children && (
                    <div className='separator__text'>
                        {children}
                    </div>
                )}
            </div>
        );
    }
}

