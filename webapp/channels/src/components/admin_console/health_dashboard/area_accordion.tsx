// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useId, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {countHealthFindingsByTab, HEALTH_SEVERITIES} from 'mattermost-redux/utils/health_utils';

import {AreaIcon, AreaLabel} from './area';
import FindingRow from './finding_row';
import type {RowState} from './finding_section';
import {severityMessages, ToneIcon} from './severity';

type Props = RowState & {
    area: string;
    findings: HealthFinding[];
};

const AreaAccordion = ({area, findings, now, expanded, onToggle}: Props) => {
    const panelId = useId();
    const counts = countHealthFindingsByTab(findings, now);
    const [open, setOpen] = useState(counts.critical > 0);

    return (
        <section className={classNames('HealthDashboard__area', {'HealthDashboard__area--open': open})}>
            <h3 className='HealthDashboard__areaHeading'>
                <button
                    type='button'
                    className='HealthDashboard__areaToggle'
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpen(!open)}
                >
                    <span className='HealthDashboard__areaIcon'>
                        <AreaIcon
                            area={area}
                            size={20}
                        />
                    </span>
                    <span className='HealthDashboard__areaText'>
                        <span className='HealthDashboard__areaTitle'>
                            <AreaLabel area={area}/>
                        </span>
                        <span className='HealthDashboard__areaCount'>
                            <FormattedMessage
                                id='admin.health_dashboard.area.count'
                                defaultMessage='{count, plural, one {# finding} other {# findings}}'
                                values={{count: findings.length}}
                            />
                        </span>
                    </span>
                    <span className='HealthDashboard__areaChips'>
                        {HEALTH_SEVERITIES.filter((severity) => counts[severity] > 0).map((severity) => (
                            <span
                                key={severity}
                                className={`HealthDashboard__chip HealthDashboard__chip--${severity}`}
                            >
                                <ToneIcon
                                    tone={severity}
                                    size={14}
                                />
                                {counts[severity]}
                                <span className='sr-only'>
                                    {' '}
                                    <FormattedMessage {...severityMessages[severity]}/>
                                </span>
                            </span>
                        ))}
                    </span>
                    <ChevronDownIcon
                        className='HealthDashboard__areaChevron'
                        size={20}
                        color='currentColor'
                        aria-hidden={true}
                    />
                </button>
            </h3>
            <ul
                id={panelId}
                className='HealthDashboard__findings HealthDashboard__areaPanel'
                hidden={!open}
            >
                {findings.map((finding) => (
                    <FindingRow
                        key={finding.fingerprint}
                        finding={finding}
                        now={now}
                        expanded={expanded === finding.fingerprint}
                        onToggle={onToggle}
                        hideArea={true}
                    />
                ))}
            </ul>
        </section>
    );
};

export default AreaAccordion;
