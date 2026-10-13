// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ProgressBar} from '@mattermost/compass-ui/components/progress-bar';

import {getUsageProgressBarProps} from 'utils/limits';

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
                <ProgressBar {...getUsageProgressBarProps(Math.floor(props.percent * 100), 'auto')}/>
            </div>
            <div className='WorkspaceLimitLine__text-status'>
                {props.limitStatus}
            </div>
        </div>
    );
}

