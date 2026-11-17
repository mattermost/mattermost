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
import Timestamp from 'components/timestamp';

import {severityMessages} from './severity';

type Props = {
    id: string;
    finding: HealthFinding;
    hidden: boolean;
};

const iconProps = {size: 18, color: 'currentColor', 'aria-hidden': true} as const;

const FindingDetail = ({id, finding, hidden}: Props) => {
    const history = useHistory();
    const details = Object.entries(finding.details ?? {}).sort(([a], [b]) => a.localeCompare(b));
    const consolePath = finding.console_path;
    const actionable = finding.state === 'firing' || finding.state === 'unknown';
    const hasLinks = Boolean(consolePath || finding.docs_url);

    // state_since resets on every state change, so a firing finding first seen earlier was in another state before.
    const seenEarlier = finding.state === 'firing' && finding.first_seen_at !== finding.state_since;

    // A firing finding's severity is already on its badge or section header.
    const showSeverity = finding.state !== 'firing';
    const hasDetails = showSeverity || seenEarlier || Boolean(finding.scope) || details.length > 0;

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
            {hasDetails && (
                <section className='HealthFinding__detailSection'>
                    <h4 className='HealthFinding__detailTitle'>
                        <FormattedMessage
                            id='admin.health_dashboard.detail.details'
                            defaultMessage='Details'
                        />
                    </h4>
                    <dl className='HealthFinding__details'>
                        {showSeverity && (
                            <>
                                <dt>
                                    <FormattedMessage
                                        id='admin.health_dashboard.detail.severity'
                                        defaultMessage='Severity'
                                    />
                                </dt>
                                <dd><FormattedMessage {...severityMessages[finding.severity]}/></dd>
                            </>
                        )}
                        {seenEarlier && (
                            <>
                                <dt>
                                    <FormattedMessage
                                        id='admin.health_dashboard.detail.first_seen'
                                        defaultMessage='First detected'
                                    />
                                </dt>
                                <dd>
                                    <Timestamp
                                        value={finding.first_seen_at}
                                        useRelative={false}
                                        useDate={{year: 'numeric', month: 'long', day: 'numeric'}}
                                        useTime={false}
                                    />
                                </dd>
                            </>
                        )}
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
            )}
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
