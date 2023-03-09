// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Bar} from 'react-chartjs-2';
import 'chartjs-plugin-annotation';
import styled from 'styled-components';

import {NullNumber} from 'src/types/stats';

const GraphBoxContainer = styled.div`
    padding: 10px;
`;

interface BarGraphProps {
    title: string;
    xlabel?: string;
    data?: NullNumber[];
    labels?: string[];
    className?: string;
    color?: string;
    tooltipTitleCallback?: (xLabel: string) => string;
    tooltipLabelCallback?: (yLabel: number) => string;
    onClick?: (index: number) => void;
    yAxesTicksCallback?: (val: number, index: number) => string;
    xAxesTicksCallback?: (val: number, index: number) => string;
    options?: any;
}

const BarGraph = (props: BarGraphProps) => {
    const style = getComputedStyle(document.body);
    const centerChannelFontColor = style.getPropertyValue('--center-channel-color');
    const colorName = props.color ? props.color : '--button-bg';
    const color = style.getPropertyValue(colorName);

    return (
        <GraphBoxContainer className={props.className}>
            <Bar
                legend={{display: false}}
                options={{
                    title: {
                        display: true,
                        text: props.title,
                        fontColor: centerChannelFontColor,
                    },
                    scales: {
                        yAxes: [{
                            ticks: {
                                callback: props.yAxesTicksCallback ? props.yAxesTicksCallback : (val: any) => {
                                    return (val % 1 === 0) ? val : null;
                                },
                                beginAtZero: true,
                                fontColor: centerChannelFontColor,
                            },
                        }],
                        xAxes: [{
                            scaleLabel: {
                                display: Boolean(props.xlabel),
                                labelString: props.xlabel,
                                fontColor: centerChannelFontColor,
                            },
                            ticks: {
                                callback: props.xAxesTicksCallback ? props.xAxesTicksCallback : (val: any, index: number) => {
                                    return (index % 2) === 0 ? val : '';
                                },
                                fontColor: centerChannelFontColor,
                                maxRotation: 0,
                            },
                        }],
                    },
                    tooltips: {
                        callbacks: {
                            title(tooltipItems: any) {
                                if (props.labels) {
                                    const label = props.labels[tooltipItems[0].index];
                                    if (props.tooltipTitleCallback) {
                                        return props.tooltipTitleCallback(label);
                                    }

                                    return label;
                                }

                                return tooltipItems[0].xLabel;
                            },
                            label(tooltipItem: any) {
                                if (props.tooltipLabelCallback) {
                                    return props.tooltipLabelCallback(tooltipItem.yLabel);
                                }
                                return tooltipItem.yLabel;
                            },
                        },
                        displayColors: false,
                    },
                    onClick(event: any, element: any) {
                        if (!props.onClick) {
                            return;
                        } else if (element.length === 0) {
                            props.onClick(-1);
                            return;
                        }
                        // eslint-disable-next-line no-underscore-dangle
                        props.onClick(element[0]._index);
                    },
                    onHover(event: any) {
                        if (props.onClick) {
                            event.target.style.cursor = 'pointer';
                        }
                    },
                    maintainAspectRatio: false,
                    responsive: true,
                    ...props.options,
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        fill: false,
                        backgroundColor: color,
                        borderColor: color,
                        pointBackgroundColor: color,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: color,

                        // This is okay, it can take nulls and numbers
                        data: props.data as number[],
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

export default BarGraph;
