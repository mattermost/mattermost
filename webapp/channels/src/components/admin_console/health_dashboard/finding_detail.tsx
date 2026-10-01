// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {HealthFinding} from '@mattermost/types/health';

import RelativeTime from './relative_time';

type Props = {
    id: string;
    finding: HealthFinding;
    hidden: boolean;
};

const FindingDetail = ({id, finding, hidden}: Props) => {
    const details = Object.entries(finding.details ?? {}).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div
            id={id}
            className='HealthFinding__detail'
            hidden={hidden}
        >
            {finding.remediation && (
                <section className='HealthFinding__detailSection'>
                    <h4 className='HealthFinding__detailTitle'>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.remediation'
                            defaultMessage='How to fix it'
                        />
                    </h4>
                    <p>{finding.remediation}</p>
                </section>
            )}
            <section className='HealthFinding__detailSection'>
                <h4 className='HealthFinding__detailTitle'>
                    <FormattedMessage
                        id='admin.health_dashboard.detail.details'
                        defaultMessage='Details'
                    />
                </h4>
                <dl className='HealthFinding__details'>
                    {finding.scope && (
                        <>
                            <dt>
                                <FormattedMessage
                                    id='admin.health_dashboard.detail.node'
                                    defaultMessage='Node'
                                />
                            </dt>
                            <dd>{finding.scope}</dd>
                        </>
                    )}
                    <dt>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.first_seen'
                            defaultMessage='First detected'
                        />
                    </dt>
                    <dd><RelativeTime value={finding.first_seen_at}/></dd>
                    <dt>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.last_seen'
                            defaultMessage='Last checked'
                        />
                    </dt>
                    <dd><RelativeTime value={finding.last_seen_at}/></dd>
                    {details.map(([key, value]) => (
                        <React.Fragment key={key}>
                            <dt><code>{key}</code></dt>
                            <dd>{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            </section>
        </div>
    );
};

export default FindingDetail;
