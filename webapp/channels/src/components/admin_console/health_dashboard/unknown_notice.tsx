// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useId, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {ChevronDownIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import FindingRow from './finding_row';
import {ToneIcon} from './severity';

type Props = {
    findings: HealthFinding[];
};

const UnknownNotice = ({findings}: Props) => {
    const [expanded, setExpanded] = useState(false);
    const listId = useId();

    if (findings.length === 0) {
        return null;
    }

    const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;

    return (
        <section className='HealthDashboard__section HealthDashboard__unknown'>
            <h3 className='HealthDashboard__sectionTitle'>
                <button
                    type='button'
                    className='HealthDashboard__sectionToggle'
                    aria-expanded={expanded}
                    aria-controls={listId}
                    onClick={() => setExpanded(!expanded)}
                >
                    <ToneIcon tone='unknown'/>
                    <FormattedMessage
                        id='admin.health_dashboard.unknown.title'
                        defaultMessage='Could not be evaluated'
                    />
                    <span className='HealthDashboard__sectionCount'>{findings.length}</span>
                    <Chevron
                        size={18}
                        color='currentColor'
                        aria-hidden={true}
                    />
                </button>
            </h3>
            <p className='HealthDashboard__unknownExplanation'>
                <FormattedMessage
                    id='admin.health_dashboard.unknown.explanation'
                    defaultMessage='These checks could not run, so their result is unknown. Unknown does not mean healthy: each one shows why it could not be checked.'
                />
            </p>
            <ul
                id={listId}
                className='HealthDashboard__findings'
                hidden={!expanded}
            >
                {findings.map((finding) => (
                    <FindingRow
                        key={finding.fingerprint}
                        finding={finding}
                    />
                ))}
            </ul>
        </section>
    );
};

export default UnknownNotice;
