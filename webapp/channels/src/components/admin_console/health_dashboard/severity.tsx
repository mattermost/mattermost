// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import {
    AlertCircleOutlineIcon,
    AlertOutlineIcon,
    CheckCircleOutlineIcon,
    HelpCircleOutlineIcon,
    InformationOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {HealthFinding, HealthFindingSeverity} from '@mattermost/types/health';

import type {HealthFindingSection} from 'mattermost-redux/utils/health_utils';

export const severityMessages = defineMessages<HealthFindingSeverity>({
    critical: {id: 'admin.health_dashboard.severity.critical', defaultMessage: 'Critical'},
    warning: {id: 'admin.health_dashboard.severity.warning', defaultMessage: 'Warning'},
    info: {id: 'admin.health_dashboard.severity.info', defaultMessage: 'Info'},
});

export const stateMessages = defineMessages({
    resolved: {id: 'admin.health_dashboard.state.resolved', defaultMessage: 'Recently resolved'},
    unknown: {id: 'admin.health_dashboard.state.unknown', defaultMessage: 'Unknown'},
});

export type Tone = HealthFindingSection;

export function getTone(finding: Pick<HealthFinding, 'severity' | 'state'>): Tone {
    return finding.state === 'firing' ? finding.severity : finding.state;
}

const icons = {
    critical: AlertCircleOutlineIcon,
    warning: AlertOutlineIcon,
    info: InformationOutlineIcon,
    resolved: CheckCircleOutlineIcon,
    unknown: HelpCircleOutlineIcon,
};

type Props = {
    tone: Tone;
    size?: number;
};

export const ToneIcon = ({tone, size = 16}: Props) => {
    const Icon = icons[tone];
    return (
        <Icon
            size={size}
            color='currentColor'
            aria-hidden={true}
        />
    );
};
