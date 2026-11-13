// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {Link, useHistory} from 'react-router-dom';

import {
    ArrowRightIcon,
    BookOutlineIcon,
    ChevronRightIcon,
    CogOutlineIcon,
    OpenInNewIcon,
} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import ExternalLink from 'components/external_link';

import RelativeTime from './relative_time';
import Trend from './trend';

type Props = {
    id: string;
    finding: HealthFinding;
    now: number;
    hidden: boolean;
};

const iconProps = {size: 18, color: 'currentColor', 'aria-hidden': true} as const;

const FindingDetail = ({id, finding, now, hidden}: Props) => {
    const history = useHistory();
    const details = Object.entries(finding.details ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const consolePath = finding.console_path;
    const actionable = finding.state === 'firing' || finding.state === 'unknown';
    const hasLinks = Boolean(consolePath || finding.docs_url);

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
            {hasLinks && (
                <section className='HealthFinding__detailSection'>
                    <h4 className='HealthFinding__detailTitle'>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.resolve'
                            defaultMessage='Resolve here'
                        />
                    </h4>
                    {consolePath && (
                        <Link
                            to={consolePath}
                            className='HealthFinding__link'
                        >
                            <span className='HealthFinding__linkIcon'>
                                <CogOutlineIcon {...iconProps}/>
                            </span>
                            <span className='HealthFinding__linkText'>
                                <FormattedMessage
                                    id='admin.health_dashboard.detail.open_setting'
                                    defaultMessage='Open this setting in the System Console'
                                />
                            </span>
                            <ChevronRightIcon {...iconProps}/>
                        </Link>
                    )}
                    {finding.docs_url && (
                        <ExternalLink
                            href={finding.docs_url}
                            location='health_dashboard_finding_detail'
                            className='HealthFinding__link'
                        >
                            <span className='HealthFinding__linkIcon'>
                                <BookOutlineIcon {...iconProps}/>
                            </span>
                            <span className='HealthFinding__linkText'>
                                <FormattedMessage
                                    id='admin.health_dashboard.detail.read_docs'
                                    defaultMessage='Read the documentation'
                                />
                            </span>
                            <OpenInNewIcon {...iconProps}/>
                        </ExternalLink>
                    )}
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
                    <dt>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.state'
                            defaultMessage='State'
                        />
                    </dt>
                    <dd>
                        <Trend
                            finding={finding}
                            now={now}
                        />
                    </dd>
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
                    {details.map(([key, value]) => (
                        <React.Fragment key={key}>
                            <dt><code>{key}</code></dt>
                            <dd>{value}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            </section>
            {actionable && consolePath && (
                <div className='HealthFinding__actions'>
                    <button
                        type='button'
                        className='btn btn-primary'
                        onClick={() => history.push(consolePath)}
                    >
                        <FormattedMessage
                            id='admin.health_dashboard.detail.go_to_setting'
                            defaultMessage='Go to setting'
                        />
                        <ArrowRightIcon {...iconProps}/>
                    </button>
                </div>
            )}
        </div>
    );
};

export default FindingDetail;
