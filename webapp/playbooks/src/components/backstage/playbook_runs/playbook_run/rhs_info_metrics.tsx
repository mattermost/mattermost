// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {HashLink as Link} from 'react-router-hash-link';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {Duration} from 'luxon';

import {PlaybookRunIDs} from 'src/components/backstage/playbook_runs/playbook_run/playbook_run';
import {Section, SectionHeader} from 'src/components/backstage/playbook_runs/playbook_run/rhs_info_styles';
import {RunMetricData} from 'src/types/playbook_run';
import {Metric, MetricType} from 'src/types/playbook';
import {formatDuration} from 'src/components/formatted_duration';
import {useAllowPlaybookAndRunMetrics} from 'src/hooks';

interface Props {
    runID: string;
    metricsData: RunMetricData[];
    metricsConfig?: Metric[];
    editable: boolean;
}

const RHSInfoMetrics = ({runID, metricsData, metricsConfig, editable}: Props) => {
    const {formatMessage} = useIntl();
    const metricsAvailable = useAllowPlaybookAndRunMetrics();

    const metricDataByID = {} as Record<string, RunMetricData>;
    metricsData.forEach((mc) => {
        metricDataByID[mc.metric_config_id] = mc;
    });

    if (!metricsAvailable || !metricsConfig || metricsConfig.length === 0) {
        return null;
    }

    const retroURL = `/playbooks/runs/${runID}#${PlaybookRunIDs.SectionRetrospective}`;

    return (
        <Section>
            <SectionHeader
                title={formatMessage({defaultMessage: 'Key Metrics'})}
                link={{
                    to: retroURL,
                    name: formatMessage({defaultMessage: 'View Retrospective'}),
                }}
            />
            <Wrapper>
                {metricsConfig.map((metricInfo) => (
                    <Item
                        key={metricInfo.id}
                        to={retroURL + metricInfo.id}
                        data={metricDataByID[metricInfo.id]}
                        info={metricInfo}
                        editable={editable}
                    />
                ))}
            </Wrapper>
        </Section>
    );
};

const Wrapper = styled.div`
    display: table;
    width: 100%;
`;

interface ItemProps {
    data: RunMetricData | null;
    info: Metric;
    editable: boolean;
    to: string;
}

const Item = ({data, info, editable, to}: ItemProps) => (
    <Row to={to}>
        <Name>{info.title}</Name>
        <Value
            metricValue={data?.value ?? null}
            metricType={info.type}
            editable={editable}
        />
    </Row>
);

const Row = styled(Link)`
    display: table-row;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    :hover, :focus {
        text-decoration: none;
    }
`;

const Name = styled.div`
    display: table-cell;
    padding: 8px 0 8px 24px;
    max-width: 180px;

    font-size: 14px;

    color: rgba(var(--center-channel-color-rgb), 0.72);

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

interface ValueProps {
    metricValue: number | null;
    metricType: MetricType;
    editable: boolean;
}

const Value = ({metricValue, metricType, editable}: ValueProps) => {
    const {formatMessage} = useIntl();

    if (metricValue === null) {
        return (
            <ValuePlaceholder>
                {/* eslint-disable-next-line formatjs/no-literal-string-in-jsx */}
                {editable ? formatMessage({defaultMessage: 'Add value...'}) : '-'}
            </ValuePlaceholder>
        );
    }

    const valueString = metricType === MetricType.MetricDuration ? formatDuration(Duration.fromMillis(metricValue)) : String(metricValue);

    return (
        <ValueContainer>{valueString}</ValueContainer>
    );
};

const ValueContainer = styled.div`
    display: table-cell;
    padding: 8px 24px 8px 36px;
    color: var(--center-channel-color);
`;

const ValuePlaceholder = styled(ValueContainer)`
    color: rgba(var(--center-channel-color-rgb), 0.4);
`;

export default RHSInfoMetrics;
