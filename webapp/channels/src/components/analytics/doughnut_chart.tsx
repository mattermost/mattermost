// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import type {ChartData} from 'chart.js';
import Chart from 'chart.js/auto';
import deepEqual from 'fast-deep-equal';
import {FormattedMessage} from 'react-intl';

type Props = {
    title: React.ReactNode;
    width: number;
    height: number;
    data?: ChartData;
}

const DoughnutChart: React.FC<Props> = ({title, width, height, data}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<Chart<'doughnut'> | null>(null);
    const prevData = useRef(data);

    useEffect(() => {
        const isEqual = data === prevData.current || deepEqual(prevData.current, data);

        if (!isEqual) {
            if (chartRef.current) {
                chartRef.current.destroy();
            }

            if (canvasRef.current && data) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const dataCopy = JSON.parse(JSON.stringify(data));
                    chartRef.current = new Chart(ctx, {
                        type: 'doughnut',
                        data: dataCopy,
                        options: {},
                    });
                }
            }

            prevData.current = data;
        }

    }, [data]);

    useEffect(() => {
        return () => {
            chartRef.current?.destroy();
        };
    }, []);

    let content;
    if (typeof data === 'undefined') {
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
                <div className='title'>
                    {title}
                </div>
                <div className='content'>
                    {content}
                </div>
            </div>
        </div>
    );
};

export default DoughnutChart;
