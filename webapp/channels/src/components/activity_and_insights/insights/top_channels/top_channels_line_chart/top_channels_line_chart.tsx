// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimeFrame, TimeFrames, TopChannel, TopChannelGraphData} from '@mattermost/types/insights';
import {GlobalState} from '@mattermost/types/store';
import moment from 'moment-timezone';
import React, {memo, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {getBool, getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity} from 'mattermost-redux/utils/theme_utils';

import LineChart from 'components/analytics/line_chart';

import './../../../activity_and_insights.scss';

type Props = {
    topChannels: TopChannel[];
    timeFrame: TimeFrame;
    channelLineChartData: TopChannelGraphData;
    timeZone: string;
}

const TopChannelsLineChart = ({topChannels, timeFrame, channelLineChartData, timeZone}: Props) => {
    const theme = useSelector(getTheme);
    const intl = useIntl();
    const isMilitaryTime = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false));

    const getLabels = useMemo(() => {
        const labels: any[] = Object.keys(channelLineChartData);

        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (timeFrame === TimeFrames.INSIGHTS_1_DAY) {
                labels[i] = intl.formatTime(Date.parse(label), {
                    hour12: isMilitaryTime ? undefined : true,
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                    timeZone,
                });
            } else {
                labels[i] = intl.formatDate(moment.tz(label, timeZone).toDate(), {
                    month: 'short',
                    day: '2-digit',
                });
            }
        }
        return labels;
    }, [channelLineChartData, timeZone]);

    const sortGraphData = useMemo(() => {
        const labels = getLabels;

        const values = {} as Record<string, number[]>;
        const keys = Object.keys(channelLineChartData);

        for (let i = 0, len = keys.length; i < len; i++) {
            const item = channelLineChartData[keys[i]];

            const channelIds = Object.keys(item);

            for (let j = 0, channelIdsLength = channelIds.length; j < channelIdsLength; j++) {
                const count = item[channelIds[j]];
                if (values[channelIds[j]]) {
                    values[channelIds[j]].push(count);
                } else {
                    values[channelIds[j]] = [count];
                }
            }
        }
        return {
            labels,
            values,
        };
    }, []);

    const getGraphData = useMemo(() => {
        const data = sortGraphData;
        const dataset = [];
        const colours = [theme.buttonBg, theme.onlineIndicator, theme.awayIndicator, theme.dndIndicator, theme.newMessageSeparator];

        for (let i = 0; i < 5; i++) {
            if (topChannels[i]) {
                const colour = colours[i];
                dataset.push({
                    fillColor: colour,
                    borderColor: colour,
                    pointBackgroundColor: colour,
                    pointBorderColor: 'transparent',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    hoverBackgroundColor: colour,
                    label: topChannels[i].display_name,
                    data: data.values[topChannels[i].id],
                    hitRadius: 10,
                    tension: 0.4,
                });
            }
        }

        return {
            datasets: dataset,
            labels: data.labels,
        };
    }, []);

    return (
        <LineChart
            title={
                <FormattedMessage
                    id='analytics.system.topChannels'
                    defaultMessage='Top Channels'
                />
            }
            id='totalPostsPerChannel'
            height={200}
            options={{
                responsive: true,
                hover: {
                    mode: 'point',
                },
                onHover: (e, activeElements) => {
                    if (e.native && e.native.target) {
                        (e.native.target as HTMLElement).style.cursor = activeElements?.length > 0 ? 'pointer' : 'auto';
                    }
                },
                maintainAspectRatio: false,
                scales: {
                    xAxis: {
                        grid: {
                            drawOnChartArea: false,
                        },
                        ticks: {
                            callback(_, index) {
                                const labels = getLabels;
                                const value = labels[index];

                                // Hide every 4th tick label for 28 day time frame
                                if (timeFrame === TimeFrames.INSIGHTS_28_DAYS) {
                                    return index % 4 === 0 ? value : '';
                                }

                                if (timeFrame === TimeFrames.INSIGHTS_1_DAY) {
                                    if (labels.length > 8 && labels.length <= 12) {
                                        return index % 2 === 0 ? value : '';
                                    }

                                    if (labels.length > 12) {
                                        return index % 4 === 0 ? value : '';
                                    }
                                }
                                return value;
                            },
                            font: {
                                family: 'Open Sans',
                                size: 10,
                            },
                            color: changeOpacity(theme.centerChannelColor, 0.72),
                        },
                    },
                    yAxis: {
                        grid: {
                            drawOnChartArea: true,
                        },
                        beginAtZero: true,
                        ticks: {
                            maxTicksLimit: 5,
                            font: {
                                family: 'Open Sans',
                                size: 10,
                            },
                            precision: 0,
                            color: changeOpacity(theme.centerChannelColor, 0.72),
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                const index = context.datasetIndex;
                                if (typeof index !== 'undefined' && context.dataset && context.dataset?.label) {
                                    const label = context.dataset?.label || '';
                                    if (label.length > 16) {
                                        return ` ${label.slice(0, 16)}...`;
                                    }
                                    return ` ${label}`;
                                }
                                return '';
                            },
                            title() {
                                return '';
                            },
                            footer(tooltipItems) {
                                return `${tooltipItems[0].parsed.y} messages`;
                            },
                        },
                        bodyFont: {
                            weight: 'bold',
                            family: 'Open Sans',
                        },
                        bodyAlign: 'left',
                        bodySpacing: 10,
                        footerFont: {
                            family: 'Open Sans',
                            size: 11,
                            style: 'normal',
                        },
                        footerAlign: 'center',
                        footerSpacing: 10,
                        footerColor: 'rgba(255, 255, 255, .64)',
                        multiKeyBackground: 'transparent',
                    },
                },
            }}
            data={getGraphData}
        />
    );
};

export default memo(TopChannelsLineChart);
