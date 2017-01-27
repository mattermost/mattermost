// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class StatisticCount extends React.Component {
    render() {
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
                        {this.props.title}
                        <i className={'fa ' + this.props.icon}/>
                    </div>
                    <div className='content'>{this.props.count == null ? loading : this.props.count}</div>
                </div>
            </div>
        );
    }
}

StatisticCount.propTypes = {
    title: React.PropTypes.node.isRequired,
    icon: React.PropTypes.string.isRequired,
    count: React.PropTypes.number
};
