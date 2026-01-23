// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    title: ReactNode;
    icon: string;
    count?: number;
    id?: string;
    children?: React.ReactNode;
    status?: 'warning' | 'error';
    formatter?: (value: number) => string;
}

const StatisticCount = ({
    title,
    icon,
    count,
    id,
    children,
    status,
    formatter,
}: Props) => {
    const loading = (
        <FormattedMessage
            id='analytics.chart.loading'
            defaultMessage='Loading...'
        />
    );

    const result = formatter ? formatter(count ?? 0) : count;
    const displayValue = typeof count === 'undefined' || isNaN(count) ? loading : result;

    return (
        <div className='grid-statistics__card'>
            <div
                className={classNames({
                    'total-count': true,
                    'total-count--has-message': Boolean(status),
                })}
            >
                <div
                    data-testid={`${id}Title`}
                    className={classNames({
                        title: true,
                        'team_statistics--warning': status === 'warning',
                        'team_statistics--error': status === 'error',
                    })}
                >
                    {title}
                    <i className={'fa ' + icon}/>
                </div>
                <div
                    data-testid={id}
                    className={classNames({
                        content: true,
                        'team_statistics--warning': status === 'warning',
                        'team_statistics--error': status === 'error',
                    })}
                >
                    {displayValue}
                </div>
            </div>
            {children}
        </div>
    );
};

export default React.memo(StatisticCount);
