// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChartOptions} from 'chart.js';
import Chart from 'chart.js/auto';
import deepEqual from 'fast-deep-equal';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';

type Props = {
    title: React.ReactNode;
    width?: number;
    height?: number;
    data?: any;
    id: string;
    options?: ChartOptions;
}

export default class LineChart extends React.PureComponent<Props> {
    private canvasRef = React.createRef<HTMLCanvasElement>();
    public static propTypes = {

        /*
         * Chart title
         */
        title: PropTypes.node.isRequired,

        /*
         * Chart width
         */
        width: PropTypes.number,

        /*
         * Chart height
         */
        height: PropTypes.number,

        /*
         * Chart data
         */
        data: PropTypes.object,

        /*
         * Chart options
         */
        options: PropTypes.object,
    };

    public chart: Chart | null = null;
    public chartOptions: ChartOptions = {
        plugins: {
            legend: {
                display: false,
            },
        },
    };

    public componentDidMount(): void {
        this.initChart();
        window.addEventListener('resize', this.resizeChart);
    }

    public componentDidUpdate(prevProps: Props): void {
        const currentData = this.props.data && this.props.data.labels.length > 0;

        if (!currentData && this.chart) {
            // Clean up the rendered chart before we render and destroy its context
            this.chart.destroy();
            this.chart = null;
        }

        if (deepEqual(prevProps.data, this.props.data)) {
            return;
        }

        const hasData = this.props.data && this.props.data.labels.length > 0;
        const hasChart = Boolean(this.chart);

        if (hasData) {
            // Update the rendered chart or initialize it as necessary
            this.initChart(hasChart);
        }
    }

    public componentWillUnmount(): void {
        if (this.chart) {
            this.chart.destroy();
        }
        window.removeEventListener('resize', this.resizeChart);
    }

    private resizeChart = () => {
        if (this.chart && this.canvasRef.current && this.chart.options.responsive) {
            this.canvasRef.current.style.width = '100%';
        }
    };

    public initChart = (update?: boolean): void => {
        if (!this.canvasRef.current) {
            return;
        }

        const ctx = this.canvasRef.current.getContext('2d') as CanvasRenderingContext2D;
        const dataCopy: any = JSON.parse(JSON.stringify(this.props.data));
        let options = this.chartOptions || {};
        if (this.props.options) {
            options = {...options, ...this.props.options};
        }

        if (update) {
            this.chart?.update();
        } else {
            this.chart = new Chart(ctx, {type: 'line', data: dataCopy, options: options || {}});
        }
    };

    public render(): JSX.Element {
        let content;
        if (this.props.data == null) {
            content = (
                <FormattedMessage
                    id='analytics.chart.loading'
                    defaultMessage='Loading...'
                />
            );
        } else if (this.props.data.labels.length === 0) {
            content = (
                <h5>
                    <FormattedMessage
                        id='analytics.chart.meaningful'
                        defaultMessage='Not enough data for a meaningful representation.'
                    />
                </h5>
            );
        } else {
            content = (
                <canvas
                    data-testid={this.props.id}
                    ref={this.canvasRef}
                    width={this.props.width}
                    height={this.props.height}
                    data-labels={this.props.data.labels}
                />
            );
        }

        return (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
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
