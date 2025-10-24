// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './circular_chart.scss';

type CircularChartProps = {
    value: number;
    isPercentage: boolean;
    width: number;
    height: number;
    type: 'info' | 'warning' | 'error' | 'success';
};

const CircularChart = ({
    value,
    isPercentage,
    width,
    height,
    type,
}: CircularChartProps): JSX.Element => {
    return (
        <div className='CircularChart'>
            <svg
                viewBox='0 0 36 36'
                className={`circular-chart ${type}`}
                width={width >= 0 ? width.toString() : '36'}
                height={height >= 0 ? height.toString() : '36'}
            >
                <path
                    className='circle-bg'
                    d='M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831'
                />
                <path
                    className='circle'
                    strokeDasharray={`${value}, 100`}
                    d='M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831'
                />
                <text
                    x='18'
                    y='20.70'
                    className='percentageOrNumber'
                >
                    {`${value}${isPercentage ? ' %' : ''}`}
                </text>
            </svg>
        </div>
    );
};

export default CircularChart;
