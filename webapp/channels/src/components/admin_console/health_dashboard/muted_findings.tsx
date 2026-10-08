// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useId} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {BellOffOutlineIcon, InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import {EmptyState} from './empty_state';
import FindingRow from './finding_row';
import type {RowState} from './finding_section';

type Props = RowState & {
    findings: HealthFinding[];
};

const MutedFindings = ({findings, now, expanded, onToggle, onMute, onUnmute}: Props) => {
    const dispatch = useDispatch();
    const headingId = useId();
    const mutedBy = [...new Set(findings.map((finding) => finding.muted_by ?? '').filter(Boolean))].sort().join(',');

    useEffect(() => {
        if (mutedBy) {
            dispatch(getMissingProfilesByIds(mutedBy.split(',')));
        }
    }, [dispatch, mutedBy]);

    return (
        <section
            className='HealthDashboard__muted'
            aria-labelledby={headingId}
        >
            <h3
                id={headingId}
                className='HealthDashboard__sectionTitle'
            >
                <span className='HealthDashboard__sectionIcon'>
                    <BellOffOutlineIcon
                        size={20}
                        color='currentColor'
                        aria-hidden={true}
                    />
                </span>
                <FormattedMessage
                    id='admin.health_dashboard.muted.title'
                    defaultMessage='Muted findings'
                />
                <span className='HealthDashboard__sectionCount'>{findings.length}</span>
                <span
                    className='HealthDashboard__sectionRule'
                    aria-hidden={true}
                />
            </h3>
            <p className='HealthDashboard__mutedNote'>
                <InformationOutlineIcon
                    size={18}
                    color='currentColor'
                    aria-hidden={true}
                />
                <FormattedMessage
                    id='admin.health_dashboard.muted.note'
                    defaultMessage='Muted findings are hidden from the open list for every admin, and they keep being checked. A different problem with the same check is still reported. Unmute a finding to return it to the open list.'
                />
            </p>
            {findings.length === 0 ? (
                <EmptyState
                    title={
                        <FormattedMessage
                            id='admin.health_dashboard.muted.empty.title'
                            defaultMessage='No muted findings'
                        />
                    }
                    body={
                        <FormattedMessage
                            id='admin.health_dashboard.muted.empty.body'
                            defaultMessage='Findings muted by any admin are listed here, with who muted them and when.'
                        />
                    }
                />
            ) : (
                <ul className='HealthDashboard__findings'>
                    {findings.map((finding) => (
                        <FindingRow
                            key={finding.fingerprint}
                            finding={finding}
                            now={now}
                            expanded={expanded === finding.fingerprint}
                            onToggle={onToggle}
                            onMute={onMute}
                            onUnmute={onUnmute}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
};

export default MutedFindings;
