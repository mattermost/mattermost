// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {Duration} from 'luxon';
import {FormattedNumber, useIntl} from 'react-intl';

import BarGraph from 'src/components/backstage/bar_graph';

import {Metric, MetricType} from 'src/types/playbook';
import {HorizontalSpacer} from 'src/components/backstage/styles';
import {NullNumber, PlaybookStats} from 'src/types/stats';
import {formatDuration} from 'src/components/formatted_duration';

interface Props {
    playbookMetrics: Metric[];
    playbookStats: PlaybookStats;
    index: number;
}

const MetricsCard = ({playbookMetrics, playbookStats, index}: Props) => {
    const {formatMessage} = useIntl();
    const stats = makeCardStats(playbookMetrics, playbookStats, index);
    const transformFn = playbookMetrics[index].type === MetricType.MetricDuration ? (val: number) => formatDuration(Duration.fromMillis(val)) : (val: number) => val;
    const valueTransformFn = playbookMetrics[index].type === MetricType.MetricDuration ? (val: number) => formatDuration(Duration.fromMillis(val), 'narrow', 'truncate') : (val: number) => val;

    const style = getComputedStyle(document.body);
    const buttonBg = style.getPropertyValue('--button-bg');
    const annotation = {
        type: 'line',
        mode: 'horizontal',
        borderColor: buttonBg,
        borderWidth: 1,
        scaleID: 'y-axis-0',
        value: stats.target,
        enabled: Boolean(stats.target),
        label: {
            backgroundColor: 'transparent',
            fontColor: buttonBg,
            fontStyle: 'normal',
            content: transformFn(stats.target || 0),
            position: 'left',
            yAdjust: -6,
            enabled: Boolean(stats.target),
        },
    };

    const titleEllipsis = ellipsize(playbookMetrics[index].title, 32);
    const chartTitle = titleEllipsis + ' ' + formatMessage({defaultMessage: 'per run over the last 10 runs'});

    return (
        <Container>
            <Card>
                <SummaryCardInner>
                    <Cell>
                        <Title>{formatMessage({defaultMessage: 'Average value'})}</Title>
                        <Value>{stats.average === null ? '-' : transformFn(stats.average)}</Value>
                    </Cell>
                    <Cell>
                        <Title>{formatMessage({defaultMessage: '10-run average value'})}</Title>
                        <Row>
                            <Value>{stats.rolling_average === null ? '-' : transformFn(stats.rolling_average)}</Value>
                            {percentageChange(stats.rolling_average_change)}
                        </Row>
                    </Cell>
                    <Cell>
                        <Title>{formatMessage({defaultMessage: 'Value range'})}</Title>
                        <Value>
                            {stats.value_range[0] === null ? '-' : valueTransformFn(stats.value_range[0])}
                            {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                            <ValueTo>{' ' + formatMessage({defaultMessage: 'to'}) + ' '}</ValueTo>
                            {stats.value_range[1] === null ? '-' : valueTransformFn(stats.value_range[1])}
                        </Value>
                    </Cell>
                    <Cell>
                        {
                            stats.target &&
                            <>
                                <Title>{formatMessage({defaultMessage: 'Target value'})}</Title>
                                <Value>{transformFn(stats.target)}</Value>
                            </>
                        }
                    </Cell>
                </SummaryCardInner>
            </Card>
            <HorizontalSpacer size={16}/>
            <Card>
                <BarGraph
                    title={chartTitle}
                    labels={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']}
                    data={stats.rolling_values}
                    color={'--center-channel-color-48'}
                    yAxesTicksCallback={(val, idx) => (idx % 2 === 0 ? '' : valueTransformFn(val).toString())}
                    xAxesTicksCallback={(val) => val.toString()}
                    tooltipTitleCallback={(label) => {
                        const runName = stats.last_x_run_names[parseInt(label, 10) - 1];
                        return ellipsize(runName, 24);
                    }}
                    tooltipLabelCallback={(val) => transformFn(val).toString()}
                    options={{
                        annotation: {
                            annotations: [
                                annotation,
                            ],
                        },
                    }}
                />
            </Card>
        </Container>
    );
};

interface MetricsCardStats {
    average: NullNumber;
    rolling_average: NullNumber;
    rolling_average_change: NullNumber;
    value_range: NullNumber[];
    rolling_values: NullNumber[];
    target: NullNumber;
    last_x_run_names: string[];
}

const makeCardStats = (playbookMetrics: Metric[], stats: PlaybookStats, idx: number) => {
    return {
        average: stats.metric_overall_average[idx] || null,
        rolling_average: stats.metric_rolling_average[idx] || null,
        rolling_average_change: stats.metric_rolling_average_change[idx] || null,
        value_range: stats.metric_value_range[idx] || [null, null],
        rolling_values: stats.metric_rolling_values[idx] || [null, null, null, null, null, null, null, null, null, null],
        target: playbookMetrics[idx].target || null,
        last_x_run_names: stats.last_x_run_names || ['', '', '', '', '', '', '', '', '', ''],
    } as MetricsCardStats;
};

const ellipsize = (original: string, charLimit: number) =>
    original.substring(0, charLimit) + (original.length > charLimit ? '...' : '');

const Container = styled.div`
    display: flex;
`;

const Card = styled.div`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.04);
    box-shadow: 0 2px 3px rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
    background: var(--center-channel-bg);
    width: 533px;
`;

const SummaryCardInner = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    grid-gap: 24px;
    padding: 24px;
`;

const Cell = styled.div`
    display: flex;
    flex-direction: column;
`;

const Title = styled.div`
    margin-bottom: 4px;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const Value = styled.div`
    font-size: 20px;
    line-height: 24px;
    font-weight: 600;
`;

const ValueTo = styled.span`
    font-weight: 400;
`;

const Row = styled.div`
    display: flex;
    align-items: center;
`;

const percentageChange = (change: NullNumber) => {
    if (!change || change >= 99999999) {
        return null;
    }
    const changeSymbol = (change > 0) ? 'icon-arrow-up' : 'icon-arrow-down';

    return (
        <PercentageChange>
            <i className={'icon ' + changeSymbol}/>
            <FormattedNumber
                value={change / 100}
                style={'percent'}
            />
        </PercentageChange>
    );
};

const PercentageChange = styled.div`
    margin-left: 12px;
    padding-right: 4px;
    display: flex;
    flex-direction: row;
    border-radius: 10px;
    background-color: rgba(var(--online-indicator-rgb), 0.08);
    color: var(--online-indicator);
    font-size: 10px;
    line-height: 15px;

    > i {
        font-size: 12px;
    }
`;

export default MetricsCard;
