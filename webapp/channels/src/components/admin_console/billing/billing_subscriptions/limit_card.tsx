// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import UsagePercentBar from 'components/common/usage_percent_bar';

import './limit_card.scss';

type Props = {
    name: JSX.Element;
    status: JSX.Element;

    // 0-100
    percent: number;
    icon: string;
    barWidth?: string;
    fullWidth?: boolean;
};

const LimitCard = (props: Props) => {
    const barWidth = props.barWidth ?? 155;
    let className = 'ProductLimitCard';
    if (props.fullWidth) {
        className += ' ProductLimitCard--full-width';
    }
    let statusClassName = 'ProductLimitCard__status';
    if (props.percent > 100) {
        statusClassName += ' ProductLimitCard__status--exceeded';
    }

    return (<div className={className}>
        <div className='ProductLimitCard__name'>
            <i className={props.icon}/>
            {props.name}
        </div>
        <div className={statusClassName}>
            {(props.percent > 100) && <i className='icon icon-alert-outline'/>}
            {props.status}
        </div>
        <UsagePercentBar
            percent={props.percent}
            barWidth={barWidth}
        />
    </div>);
};
export default LimitCard;
