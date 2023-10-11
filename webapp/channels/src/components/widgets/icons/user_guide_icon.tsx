// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

type Props = React.HTMLAttributes<HTMLSpanElement>;

export default function UserGuideIcon(props: Props): JSX.Element {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='18px'
                height='18px'
                viewBox='1 1 22 22'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.userGuide', defaultMessage: 'Help'})}
                style={{width: '18px', height: '18px'}}
            >
                <path d='M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z'/>
            </svg>
        </span>
    );
}
