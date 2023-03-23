// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Duration} from 'luxon';
import styled from 'styled-components';

import {FormattedMessage} from 'react-intl';

import {MetricsInfo} from 'src/components/backstage/metrics/metrics_run_list';

import {PlaybookRun} from 'src/types/playbook_run';
import {formatDuration} from 'src/components/formatted_duration';
import {navigateToPluginUrl} from 'src/browser_routing';
import {MetricType} from 'src/types/playbook';

interface Props {
    metricsInfo: MetricsInfo[];
    playbookRun: PlaybookRun;
}

const MetricsRow = ({metricsInfo, playbookRun}: Props) => {
    function openPlaybookRunDetails() {
        navigateToPluginUrl(`/runs/${playbookRun.id}`);
    }

    // If there is a metricsInfo, but this run doesn't have a value for it:
    const metrics = metricsInfo.map((m, idx) => playbookRun.metrics_data[idx] || {value: null});

    return (
        <PlaybookRunItem
            className='row'
            onClick={openPlaybookRunDetails}
        >
            <div className='col-sm-4'>
                <RunName>{playbookRun.name}</RunName>
            </div>
            {metrics.map((m, idx) => (
                <Cell
                    key={idx}
                    type={metricsInfo[idx].type}
                    value={m.value}
                    target={metricsInfo[idx].target}
                />
            ))}
        </PlaybookRunItem>
    );
};

interface CellProps {
    type: MetricType;
    value: number | null;
    target: number;
}

const Cell = ({type, value, target}: CellProps) => {
    if (!value) {
        return (
            <div className='col-sm-2'>
                <NAValue><FormattedMessage defaultMessage='N/A'/></NAValue>
            </div>
        );
    }

    const valueAsDuration = Duration.fromMillis(value);
    let val = <>{value}</>;
    const prefix = value < target ? '- ' : '+ ';
    let diff = prefix + Math.abs(value - target);
    if (type === MetricType.MetricDuration) {
        val = <div className='time'>{formatDuration(valueAsDuration)}</div>;
        diff = prefix + formatDuration(Duration.fromMillis(target).minus(valueAsDuration));
    }

    return (
        <div className='col-sm-2'>
            <NormalText>{val}</NormalText>
            <SmallText>{diff}</SmallText>
        </div>
    );
};

const NAValue = styled.div`
    font-weight: 400;
    line-height: 16px;
    color: var(--error-text);
`;

const NormalText = styled.div`
    font-weight: 400;
    line-height: 16px;
`;

const SmallText = styled.div`
    font-weight: 400;
    font-size: 11px;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.64);
    margin: 5px 0;
`;

const RunName = styled.div`
    font-weight: 600;
    font-size: 14px;
    line-height: 16px;
`;

const PlaybookRunItem = styled.div`
    display: flex;
    padding-top: 8px;
    padding-bottom: 8px;
    align-items: center;
    margin: 0;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    cursor: pointer;
    background: var(--center-channel-bg);

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.04);
    }
`;

export default MetricsRow;
