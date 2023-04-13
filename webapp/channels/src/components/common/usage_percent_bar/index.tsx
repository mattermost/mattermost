// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled from 'styled-components';

import {limitThresholds} from 'utils/limits';

type Thresholds = {
    ok: number;
    warn: number;
    danger: number;
    exceeded: number;
}

type Props = {

    // 0-100, i.e. not a 0-1 decimal
    percent: number;
    thresholds?: Thresholds;
    barWidth?: number | string;
}

const defaultThresholds = limitThresholds;

type BarBackgroundProps = {
    width: number | string;
    thresholds: Thresholds;
    percent: number;
}

const BarBackground = styled.div<BarBackgroundProps>`
    height: ${(props) => (typeof props.width === 'number' ? Math.ceil(props.width / 20).toString() + 'px' : '8px')};
    width: ${(props) => (typeof props.width === 'number' ? props.width.toString() + 'px' : props.width)};
    background: ${(props) => (
        isExceeded(props.percent, props.thresholds) ?
            'var(--dnd-indicator)' :
            'rgba(var(--center-channel-color-rgb), 0.11)'
    )};
    border-radius: 8px;
    position: relative;
`;

type BarForegroundProps = {
    width: number | string;
    percent: number;
    thresholds: Thresholds;
}

function getColor(percent: number, thresholds: Thresholds): string {
    switch (true) {
    case percent < thresholds.ok:
        return '';
    case percent < thresholds.warn:
        return 'var(--online-indicator)';
    case percent < thresholds.danger || percent > thresholds.exceeded:
        // exceeded case also has a red background, applied elsewhere
        return 'var(--away-indicator)';
    case percent < thresholds.exceeded:
        return 'var(--dnd-indicator)';
    default:
        return '';
    }
}

function isExceeded(percent: number, thresholds: Thresholds): boolean {
    return percent >= thresholds.exceeded;
}

const BarForeground = styled.div<BarForegroundProps>`
    height: 100%;
    width: ${(props) => (isExceeded(props.percent, props.thresholds) ? 91 : props.percent)}%;
    border-radius: 8px;
    background-color: ${(props) => getColor(props.percent, props.thresholds)};
    transition: background-color 0.4s ease, width 0.4s ease;
    position: absolute;
`;

const UsagePercentBar = (props: Props) => {
    const thresholds = props.thresholds || defaultThresholds;
    const percent = Math.max(0, props.percent);
    const barWidth = props.barWidth || 155;
    return (
        <BarBackground
            width={barWidth}
            thresholds={thresholds}
            percent={percent}
        >
            <BarForeground
                width={barWidth}
                thresholds={thresholds}
                percent={percent}
            />
        </BarBackground>
    );
};

export default UsagePercentBar;

