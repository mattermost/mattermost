// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import {
    AlertCircleOutlineIcon,
    AlertOutlineIcon,
    HelpCircleOutlineIcon,
    InformationOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {HealthFinding, HealthFindingSeverity} from '@mattermost/types/health';

export const SEVERITIES: HealthFindingSeverity[] = ['critical', 'warning', 'info'];

export const severityMessages = defineMessages<HealthFindingSeverity>({
    critical: {id: 'admin.health_dashboard.severity.critical', defaultMessage: 'Critical'},
    warning: {id: 'admin.health_dashboard.severity.warning', defaultMessage: 'Warning'},
    info: {id: 'admin.health_dashboard.severity.info', defaultMessage: 'Info'},
});

type Tone = HealthFindingSeverity | 'unknown';

export function getTone(finding: Pick<HealthFinding, 'severity' | 'state'>): Tone {
    return finding.state === 'unknown' ? 'unknown' : finding.severity;
}

const icons = {
    critical: AlertCircleOutlineIcon,
    warning: AlertOutlineIcon,
    info: InformationOutlineIcon,
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
