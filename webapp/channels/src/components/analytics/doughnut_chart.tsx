// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChartData} from 'chart.js';
import Chart from 'chart.js/auto';
import deepEqual from 'fast-deep-equal';
import React, {useEffect, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    title: React.ReactNode;
    width: number;
    height: number;
    data?: ChartData;
};

const DoughnutChart: React.FC<Props> = ({title, width, height, data}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<Chart<'doughnut'> | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !data) {
            return;
        }

        const ctx = canvasRef.current.getContext('2d');

        if (!ctx) {
            return;
        }

        if (chartRef.current) {
            if (!deepEqual(chartRef.current.data, data)) {
                chartRef.current.data = JSON.parse(JSON.stringify(data));
                chartRef.current.update();
            }
        } else {
            chartRef.current = new Chart(ctx, {
                type: 'doughnut',
                data: JSON.parse(JSON.stringify(data)),
                options: {},
            });
        }
    }, [data]);

    useEffect(() => {
        return () => {
            chartRef.current?.destroy();
            chartRef.current = null;
        };
    }, []);

    let content;
    if (typeof data == 'undefined') {
        content = (
            <FormattedMessage
                id='analytics.chart.loading'
                defaultMessage='Loading...'
            />
        );
    } else {
        content = (
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
            />
        );
    }

    return (
        <div className='col-sm-6'>
            <div className='total-count'>
                <div className='title'>{title}</div>
                <div className='content'>{content}</div>
            </div>
        </div>
    );
};

export default DoughnutChart;
