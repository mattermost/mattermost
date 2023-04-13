// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './progress_bar.scss';

type Props = {
    total: number;
    current: number;
    basePercentage?: number;
};

const ProgressBar: React.FC<Props> = (props: Props) => {
    return (
        <div className='ProgressBar'>
            <div
                className='ProgressBar__progress'
                style={{
                    flexBasis: props.basePercentage ? `${props.basePercentage}%` : '',
                    flexGrow: props.current / props.total,
                }}
            />
        </div>
    );
};

export default ProgressBar;
