// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import deepEqual from 'fast-deep-equal';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import Chart from 'chart.js/auto';
import {ChartData} from 'chart.js';

type Props = {
    title: React.ReactNode;
    width: number;
    height: number;
    data?: ChartData;
}

export default class DoughnutChart extends React.PureComponent<Props> {
    private canvasRef = React.createRef<HTMLCanvasElement>();

    public chart: Chart | null = null;

    public componentDidMount(): void {
        this.initChart();
    }

    public componentDidUpdate(prevProps: Props): void {
        if (!deepEqual(prevProps.data, this.props.data)) {
            this.initChart(true);
        }
    }

    public componentWillUnmount(): void {
        if (this.chart && this.canvasRef.current) {
            this.chart.destroy();
        }
    }

    public initChart = (update?: boolean): void => {
        if (typeof this.props.data === 'undefined') {
            return;
        }

        if (!this.canvasRef.current) {
            return;
        }

        const ctx = this.canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
        const dataCopy = JSON.parse(JSON.stringify(this.props.data));

        if (update) {
            this.chart?.update();
        } else {
            this.chart = new Chart(ctx, {type: 'doughnut', data: dataCopy, options: {}});
        }
    };

    public render(): JSX.Element {
        let content;
        if (typeof this.props.data === 'undefined') {
            content = (
                <FormattedMessage
                    id='analytics.chart.loading'
                    defaultMessage='Loading...'
                />
            );
        } else {
            content = (
                <canvas
                    ref={this.canvasRef}
                    width={this.props.width}
                    height={this.props.height}
                />
            );
        }

        return (
            <div className='col-sm-6'>
                <div className='total-count'>
                    <div className='title'>
                        {this.props.title}
                    </div>
                    <div className='content'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}
