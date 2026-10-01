// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {HealthFindingSeverity} from '@mattermost/types/health';

import RelativeTime from './relative_time';
import {SEVERITIES, severityMessages, ToneIcon} from './severity';

type Props = {
    severityCounts: Record<HealthFindingSeverity, number>;
    unknownCount: number;
    lastEvaluatedAt: number;
};

const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

const SeveritySummary = ({severityCounts, unknownCount, lastEvaluatedAt}: Props) => {
    const {formatMessage} = useIntl();

    return (
        <div className='HealthDashboard__summary'>
            <p className='HealthDashboard__lastEvaluated'>
                <FormattedMessage
                    id='admin.health_dashboard.last_evaluated'
                    defaultMessage='Last evaluated {time}'
                    values={{time: <RelativeTime value={lastEvaluatedAt}/>}}
                />
            </p>
            <ul
                className='HealthDashboard__counts'
                aria-label={formatMessage({id: 'admin.health_dashboard.counts.label', defaultMessage: 'Finding counts'})}
            >
                {SEVERITIES.map((severity) => (
                    <li
                        key={severity}
                        className={`HealthDashboard__count HealthDashboard__count--${severity}`}
                    >
                        <ToneIcon tone={severity}/>
                        <FormattedMessage
                            id='admin.health_dashboard.counts.severity'
                            defaultMessage='<b>{count}</b> {severity}'
                            values={{
                                count: severityCounts[severity],
                                severity: formatMessage(severityMessages[severity]),
                                b: bold,
                            }}
                        />
                    </li>
                ))}
                <li className='HealthDashboard__count HealthDashboard__count--unknown'>
                    <ToneIcon tone='unknown'/>
                    <FormattedMessage
                        id='admin.health_dashboard.counts.unknown'
                        defaultMessage='<b>{count}</b> Unknown'
                        values={{count: unknownCount, b: bold}}
                    />
                </li>
            </ul>
        </div>
    );
};

export default SeveritySummary;
