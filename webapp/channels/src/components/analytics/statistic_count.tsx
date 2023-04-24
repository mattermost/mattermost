// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    title: ReactNode;
    icon: string;
    count?: number;
    id?: string;
    children?: React.ReactNode;
    status?: 'warning' | 'error';
}

export default class StatisticCount extends React.PureComponent<Props> {
    public render(): JSX.Element {
        const loading = (
            <FormattedMessage
                id='analytics.chart.loading'
                defaultMessage='Loading...'
            />
        );

        return (
            <div className='grid-statistics__card'>
                <div
                    className={classNames({
                        'total-count': true,
                        'total-count--has-message': Boolean(this.props.status),
                    })}
                >
                    <div
                        data-testid={`${this.props.id}Title`}
                        className={classNames({
                            title: true,
                            'team_statistics--warning': this.props.status === 'warning',
                            'team_statistics--error': this.props.status === 'error',
                        })}
                    >
                        {this.props.title}
                        <i className={'fa ' + this.props.icon}/>
                    </div>
                    <div
                        data-testid={this.props.id}
                        className={classNames({
                            content: true,
                            'team_statistics--warning': this.props.status === 'warning',
                            'team_statistics--error': this.props.status === 'error',
                        })}
                    >
                        {typeof this.props.count === 'undefined' || isNaN(this.props.count) ? loading : this.props.count}
                    </div>
                </div>
                {this.props.children}
            </div>
        );
    }
}
