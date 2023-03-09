// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Line} from 'react-chartjs-2';
import styled from 'styled-components';

const GraphBoxContainer = styled.div`
    padding: 10px;
`;

interface LineGraphProps {
    title: string
    xlabel?: string
    data?: number[]
    labels?: string[]
    className?: string
    tooltipTitleCallback?: (xLabel: string) => string
    tooltipLabelCallback?: (yLabel: number) => string
    onClick?: (index: number) => void
}

const LineGraph = (props: LineGraphProps) => {
    const style = getComputedStyle(document.body);
    const centerChannelFontColor = style.getPropertyValue('--center-channel-color');
    const buttonBgColor = style.getPropertyValue('--button-bg');
    return (
        <GraphBoxContainer className={props.className}>
            {/*@ts-ignore*/}
            <Line
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
                                callback: (val: any) => {
                                    return (val % 1 === 0) ? val : null;
                                },
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
                                callback: (val: any, index: number) => {
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
                }}
                data={{
                    labels: props.labels,
                    datasets: [{
                        tension: 0,
                        fill: false,
                        backgroundColor: buttonBgColor,
                        borderColor: buttonBgColor,
                        pointBackgroundColor: buttonBgColor,
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: buttonBgColor,
                        data: props.data,
                    }],
                }}
            />
        </GraphBoxContainer>
    );
};

export default LineGraph;
