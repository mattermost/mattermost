// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default function StatisticCount(props) {
    const loading = (
        <FormattedMessage
            id='analytics.chart.loading'
            defaultMessage='Loading...'
        />
    );

    return (
        <div className='col-md-3 col-sm-6'>
            <div className='total-count'>
                <div className='title'>
                    {props.title}
                    <i className={'fa ' + props.icon}/>
                </div>
                <div className='content'>{props.count == null ? loading : props.count}</div>
            </div>
        </div>
    );
}

StatisticCount.propTypes = {
    title: React.PropTypes.node.isRequired,
    icon: React.PropTypes.string.isRequired,
    count: React.PropTypes.number
};
