// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChartData} from 'chart.js';
import Chart from 'chart.js/auto';
import deepEqual from 'fast-deep-equal';
import React, {useEffect, useRef} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';

import {formatAsString} from 'utils/i18n';

type Props = {
    title: React.ReactNode;
    width: number;
    height: number;
    data?: ChartData;
};

const DoughnutChart: React.FC<Props> = ({title, width, height, data}) => {
    const intl = useIntl();

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

        const translatedData = JSON.parse(JSON.stringify(data));
        translatedData.labels = translatedData.labels?.map((message: MessageDescriptor) => formatAsString(intl.formatMessage, message));

        if (chartRef.current) {
            if (!deepEqual(chartRef.current.data, translatedData)) {
                chartRef.current.data = translatedData;
                chartRef.current.update();
            }
        } else {
            chartRef.current = new Chart(ctx, {
                type: 'doughnut',
                data: translatedData,
                options: {},
            });
        }
    }, [data, intl]);

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
