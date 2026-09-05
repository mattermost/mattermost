// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PlaybookStats} from 'src/types/stats';
import {Metric, MetricType} from 'src/types/playbook';
import {ClockOutline, DollarSign, PoundSign} from 'src/components/backstage/playbook_edit/styles';

import MetricsCard from './metrics_card';

interface Props {
    playbookMetrics: Metric[];
    stats: PlaybookStats;
}

const MetricsStatsView = ({playbookMetrics, stats}: Props) => {
    return (
        <>
            {
                playbookMetrics.map((metric, idx) => (
                    <>
                        <MetricHeader
                            key={idx}
                            metric={metric}
                        />
                        <MetricsCard
                            playbookMetrics={playbookMetrics}
                            playbookStats={stats}
                            index={idx}
                        />
                    </>
                ))
            }
        </>
    );
};

const MetricHeader = ({metric}: { metric: Metric }) => {
    let icon = <DollarSign sizePx={18}/>;
    if (metric.type === MetricType.MetricInteger) {
        icon = <PoundSign sizePx={18}/>;
    } else if (metric.type === MetricType.MetricDuration) {
        icon = <ClockOutline sizePx={18}/>;
    }

    return (
        <Header>
            <Icon>{icon}</Icon>
            <Title>{metric.title}</Title>
            <HorizontalLine/>
        </Header>
    );
};

const Header = styled.div`
    display: flex;
    align-items: center;
    margin: 24px 0 8px;
    color: var(--center-channel-color);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;

    svg {
        margin-right: 7px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
`;

const Icon = styled.div`
    margin-bottom: -6px;
`;

const Title = styled.div`
    white-space: nowrap;
`;

const HorizontalLine = styled.div`
    width: 100%;
    height: 0;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    margin: 0 0 0 16px;
`;

export default MetricsStatsView;
