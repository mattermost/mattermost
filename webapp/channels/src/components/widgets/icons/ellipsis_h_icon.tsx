// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

type Props = React.HTMLAttributes<HTMLSpanElement> & {
    width?: string;
    height?: string;
};

export default function EllipsisHorizontalIcon(props: Props) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width={props.width || '24px'}
                height={props.width || '24px'}
                viewBox='0 0 24 24'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.elipsisHorizontalIcon', defaultMessage: 'Ellipsis Horizontal Icon'})}
            >
                <path d='M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z'/>
            </svg>
        </span>
    );
}

