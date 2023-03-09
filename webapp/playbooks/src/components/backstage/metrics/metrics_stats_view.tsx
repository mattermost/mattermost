// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
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
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    color: var(--center-channel-color);
    margin: 24px 0 8px 0;

    svg {
        color: rgba(var(--center-channel-color-rgb), 0.56);
        margin-right: 7px;
    }
`;

const Icon = styled.div`
    margin-bottom: -6px;
`;

const Title = styled.div`
    white-space: nowrap;
`;

const HorizontalLine = styled.div`
    height: 0;
    width: 100%;
    margin: 0 0 0 16px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
`;

export default MetricsStatsView;
