// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {HealthFinding} from '@mattermost/types/health';

import type {HealthFindingSection} from 'mattermost-redux/utils/health_utils';

import FindingRow from './finding_row';
import {severityMessages, stateMessages, ToneIcon} from './severity';

export type RowState = {
    now: number;
    expanded: string | null;
    onToggle: (fingerprint: string) => void;
};

const sectionMessages: Record<HealthFindingSection, MessageDescriptor> = {
    ...severityMessages,
    unknown: defineMessage({id: 'admin.health_dashboard.unknown.title', defaultMessage: 'Could not be evaluated'}),
    resolved: stateMessages.resolved,
};

type Props = RowState & {
    section: HealthFindingSection;
    findings: HealthFinding[];
};

const FindingSection = ({section, findings, now, expanded, onToggle}: Props) => {
    const headingId = useId();

    return (
        <section
            className={`HealthDashboard__section HealthDashboard__section--${section}`}
            aria-labelledby={headingId}
        >
            <h3
                id={headingId}
                className='HealthDashboard__sectionTitle'
            >
                <span className='HealthDashboard__sectionIcon'>
                    <ToneIcon
                        tone={section}
                        size={20}
                    />
                </span>
                <FormattedMessage {...sectionMessages[section]}/>
                <span className='HealthDashboard__sectionCount'>{findings.length}</span>
                <span
                    className='HealthDashboard__sectionRule'
                    aria-hidden={true}
                />
            </h3>
            {section === 'unknown' && (
                <p className='HealthDashboard__unknownExplanation'>
                    <FormattedMessage
                        id='admin.health_dashboard.unknown.explanation'
                        defaultMessage='These checks could not run, so their result is unknown. Unknown does not mean healthy: each one shows why it could not be checked.'
                    />
                </p>
            )}
            <ul className='HealthDashboard__findings'>
                {findings.map((finding) => (
                    <FindingRow
                        key={finding.fingerprint}
                        finding={finding}
                        now={now}
                        expanded={expanded === finding.fingerprint}
                        onToggle={onToggle}
                    />
                ))}
            </ul>
        </section>
    );
};

export default FindingSection;
