// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import UsagePercentBar from 'components/common/usage_percent_bar';

import './limit_line.scss';

interface Props {
    icon: string;
    limitName: React.ReactNode;
    limitStatus: React.ReactNode;
    percent: number;
    showIcons?: boolean;
}

export default function LimitLine(props: Props) {
    return (
        <div className='WorkspaceLimitLine'>
            {props.showIcons && <i className={`WorkspaceLimitLine__icon ${props.icon}`}/>}
            <div className='WorkspaceLimitLine__bar'>
                <div className='WorkspaceLimitLine__bar-label'>{props.limitName}</div>
                <UsagePercentBar
                    barWidth='auto'
                    percent={Math.floor(props.percent * 100)}
                />
            </div>
            <div className='WorkspaceLimitLine__text-status'>
                {props.limitStatus}
            </div>
        </div>
    );
}

