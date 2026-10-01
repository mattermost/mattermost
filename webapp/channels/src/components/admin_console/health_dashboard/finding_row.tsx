// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import FindingDetail from './finding_detail';
import RelativeTime from './relative_time';
import {getTone, severityMessages, ToneIcon} from './severity';

type Props = {
    finding: HealthFinding;
};

const FindingRow = ({finding}: Props) => {
    const {formatMessage} = useIntl();
    const [expanded, setExpanded] = useState(false);
    const detailId = useId();

    const tone = getTone(finding);
    const isUnknown = tone === 'unknown';
    const title = finding.title || finding.code;
    const severity = formatMessage(severityMessages[finding.severity]);

    let message = finding.message;
    if (!message && isUnknown) {
        message = formatMessage({
            id: 'admin.health_dashboard.finding.unknown_fallback',
            defaultMessage: 'This check could not run, so its result is unknown.',
        });
    }

    const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;

    return (
        <li
            className={`HealthFinding HealthFinding--${tone}`}
            data-testid={`healthFinding-${finding.fingerprint}`}
        >
            <button
                type='button'
                className='HealthFinding__header'
                aria-expanded={expanded}
                aria-controls={detailId}
                onClick={() => setExpanded(!expanded)}
            >
                <span className='HealthFinding__icon'>
                    <ToneIcon
                        tone={tone}
                        size={18}
                    />
                </span>
                <span className='HealthFinding__body'>
                    <span className='HealthFinding__title'>
                        {finding.scope ? (
                            <FormattedMessage
                                id='admin.health_dashboard.finding.title_on_node'
                                defaultMessage='{title} on {node}'
                                values={{title, node: finding.scope}}
                            />
                        ) : title}
                    </span>
                    {message && <span className='HealthFinding__message'>{message}</span>}
                    <span className='HealthFinding__meta'>
                        <span className='HealthFinding__badge'>
                            {isUnknown ? (
                                <FormattedMessage
                                    id='admin.health_dashboard.finding.unknown_badge'
                                    defaultMessage='Unknown ({severity} when firing)'
                                    values={{severity}}
                                />
                            ) : severity}
                        </span>
                        <span>
                            {isUnknown ? (
                                <FormattedMessage
                                    id='admin.health_dashboard.finding.unknown_since'
                                    defaultMessage='Became unknown {time}'
                                    values={{time: <RelativeTime value={finding.state_since}/>}}
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.health_dashboard.finding.firing_since'
                                    defaultMessage='Started firing {time}'
                                    values={{time: <RelativeTime value={finding.state_since}/>}}
                                />
                            )}
                        </span>
                    </span>
                </span>
                <Chevron
                    className='HealthFinding__chevron'
                    size={18}
                    color='currentColor'
                    aria-hidden={true}
                />
            </button>
            <FindingDetail
                id={detailId}
                finding={finding}
                hidden={!expanded}
            />
        </li>
    );
};

export default FindingRow;
