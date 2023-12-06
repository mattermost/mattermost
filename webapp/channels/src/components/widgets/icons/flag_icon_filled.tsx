// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export default function FlagIconFilled(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='12px'
                height='15px'
                viewBox='0 0 12 15'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.flagged', defaultMessage: 'Flagged Icon'})}
            >
                <g
                    stroke='none'
                    strokeWidth='1'
                    fill='inherit'
                    fillRule='evenodd'
                >
                    <g
                        transform='translate(-1073.000000, -33.000000)'
                        fillRule='nonzero'
                        fill='inherit'
                    >
                        <g transform='translate(-1.000000, 0.000000)'>
                            <g transform='translate(1064.000000, 22.000000)'>
                                <g transform='translate(10.000000, 11.000000)'>
                                    <path d='M9.76172 0.800049H2.23828C1.83984 0.800049 1.48828 0.952393 1.18359 1.25708C0.902344 1.53833 0.761719 1.88989 0.761719 2.31177V14.3L6 12.05L11.2383 14.3V2.31177C11.2383 1.88989 11.0859 1.53833 10.7812 1.25708C10.5 0.952393 10.1602 0.800049 9.76172 0.800049Z'/>
                                </g>
                            </g>
                        </g>
                    </g>
                </g>
            </svg>
        </span>
    );
}
