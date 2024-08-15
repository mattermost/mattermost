// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import type {ChartData} from 'chart.js';
import Chart from 'chart.js/auto';
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

    useEffect(() => {
        if (!data || !canvasRef.current) {
            return;
        }

        const ctx = canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
        const dataCopy = JSON.parse(JSON.stringify(data));

        if (chartRef.current) {
            chartRef.current.update();
        } else {
            chartRef.current = new Chart(ctx, {
                type: 'doughnut',
                data: dataCopy,
                options: {},
            });
        }

        return () => {
            chartRef.current?.destroy();
            chartRef.current = null;
        };
    }, [data]);

    return (
        <div className='col-sm-6'>
            <div className='total-count'>
                <div className='title'>
                    {title}
                </div>
                <div className='content'>
                    {data ? (
                        <canvas
                            ref={canvasRef}
                            width={width}
                            height={height}
                        />
                    ) : (
                        <FormattedMessage
                            id='analytics.chart.loading'
                            defaultMessage='Loading...'
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoughnutChart;
