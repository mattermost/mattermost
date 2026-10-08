// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useId} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {BellOffOutlineIcon, ChevronRightIcon, ChevronUpIcon, ClockOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {getHealthFindingSection, isHealthFindingMuted} from 'mattermost-redux/utils/health_utils';

import {AreaIcon, AreaLabel} from './area';
import FindingDetail from './finding_detail';
import MuteButton from './mute_button';
import MutedBy from './muted_by';
import {severityMessages, ToneIcon} from './severity';
import Trend from './trend';

type Props = {
    finding: HealthFinding;
    now: number;
    expanded: boolean;
    onToggle: (fingerprint: string) => void;
    onMute: (finding: HealthFinding) => void;
    onUnmute: (fingerprint: string) => void;
    hideArea?: boolean;
};

const FindingRow = ({finding, now, expanded, onToggle, onMute, onUnmute, hideArea = false}: Props) => {
    const {formatMessage} = useIntl();
    const detailId = useId();

    const tone = getHealthFindingSection(finding);
    const title = finding.title || finding.code;
    const muted = isHealthFindingMuted(finding);
    const severity = formatMessage(severityMessages[finding.severity]);

    let message = finding.message;
    if (!message && finding.state === 'unknown') {
        message = formatMessage({
            id: 'admin.health_dashboard.finding.unknown_fallback',
            defaultMessage: 'This check could not run, so its result is unknown.',
        });
    }

    let badge: React.ReactNode = severity;
    if (finding.state === 'unknown') {
        badge = (
            <FormattedMessage
                id='admin.health_dashboard.finding.unknown_badge'
                defaultMessage='Unknown ({severity} when firing)'
                values={{severity}}
            />
        );
    } else if (finding.state === 'resolved') {
        badge = (
            <FormattedMessage
                id='admin.health_dashboard.finding.resolved_badge'
                defaultMessage='Resolved ({severity} when firing)'
                values={{severity}}
            />
        );
    }

    const Chevron = expanded ? ChevronUpIcon : ChevronRightIcon;

    return (
        <li
            className={classNames('HealthFinding', `HealthFinding--${tone}`, {
                'HealthFinding--expanded': expanded,
                'HealthFinding--muted': muted,
            })}
            data-testid={`healthFinding-${finding.fingerprint}`}
        >
            <div className='HealthFinding__summary'>
                <button
                    type='button'
                    className='HealthFinding__header'
                    aria-expanded={expanded}
                    aria-controls={detailId}
                    onClick={() => onToggle(finding.fingerprint)}
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
                            <span className='HealthFinding__badge'>{badge}</span>
                            {!hideArea && (
                                <span
                                    className='HealthFinding__tag'
                                    data-testid='healthFindingArea'
                                >
                                    <AreaIcon
                                        area={finding.area}
                                        size={14}
                                    />
                                    <AreaLabel area={finding.area}/>
                                </span>
                            )}
                            <span className='HealthFinding__tag'>
                                <ClockOutlineIcon
                                    size={14}
                                    color='currentColor'
                                    aria-hidden={true}
                                />
                                <Trend
                                    finding={finding}
                                    now={now}
                                />
                            </span>
                            {muted && (
                                <span
                                    className='HealthFinding__tag'
                                    data-testid='healthFindingMutedBy'
                                >
                                    <BellOffOutlineIcon
                                        size={14}
                                        color='currentColor'
                                        aria-hidden={true}
                                    />
                                    <MutedBy finding={finding}/>
                                </span>
                            )}
                        </span>
                    </span>
                    <Chevron
                        className='HealthFinding__chevron'
                        size={18}
                        color='currentColor'
                        aria-hidden={true}
                    />
                </button>
                <span className='HealthFinding__action'>
                    <MuteButton
                        finding={finding}
                        muted={muted}
                        onMute={onMute}
                        onUnmute={onUnmute}
                    />
                </span>
            </div>
            <FindingDetail
                id={detailId}
                finding={finding}
                now={now}
                hidden={!expanded}
            />
        </li>
    );
};

export default React.memo(FindingRow);
