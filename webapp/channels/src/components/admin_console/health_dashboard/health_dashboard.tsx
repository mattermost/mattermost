// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useId, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {
    countHealthFindingsByTab,
    filterHealthFindingsByTab,
    groupHealthFindingsByArea,
    groupHealthFindingsBySection,
} from 'mattermost-redux/utils/health_utils';
import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {orderAreas} from './area';
import AreaAccordion from './area_accordion';
import {EmptyState, TabEmptyState} from './empty_state';
import FindingSection from './finding_section';
import type {RowState} from './finding_section';
import FindingTabs, {tabId} from './finding_tabs';
import GroupByControl from './group_by_control';
import type {GroupBy} from './group_by_control';
import RelativeTime from './relative_time';

import './health_dashboard.scss';

export type Props = {
    findings: HealthFinding[];
    lastEvaluatedAt: number;
    actions: {
        getHealthFindings: (filter?: HealthFindingFilter) => Promise<ActionResult<HealthFindingList>>;
    };
};

type FindingGroupsProps = RowState & {
    findings: HealthFinding[];
    groupBy: GroupBy;
    tab: HealthFindingTab;
};

const FindingGroups = ({findings, groupBy, tab, ...rowState}: FindingGroupsProps) => {
    if (groupBy === 'category') {
        const byArea = groupHealthFindingsByArea(findings);
        return (
            <>
                {orderAreas(byArea).map((area) => (
                    <AreaAccordion
                        key={area}
                        area={area}
                        findings={byArea[area]}
                        expandAll={tab !== 'open'}
                        {...rowState}
                    />
                ))}
            </>
        );
    }

    return (
        <>
            {groupHealthFindingsBySection(findings).map(({section, findings: sectionFindings}) => (
                <FindingSection
                    key={section}
                    section={section}
                    findings={sectionFindings}
                    {...rowState}
                />
            ))}
        </>
    );
};

const HealthDashboard = ({findings, lastEvaluatedAt, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [tab, setTab] = useState<HealthFindingTab>('open');
    const [groupBy, setGroupBy] = useState<GroupBy>('severity');
    const [expanded, setExpanded] = useState<string | null>(null);
    const idPrefix = useId();
    const panelId = `${idPrefix}-panel`;

    useEffect(() => {
        actions.getHealthFindings().then(({error}) => {
            setFailed(Boolean(error));
            setNow(Date.now());
            setLoading(false);
        });
    }, [actions]);

    const changeTab = useCallback((next: HealthFindingTab) => {
        setTab(next);
        setExpanded(null);
    }, []);

    const changeGroupBy = useCallback((next: GroupBy) => {
        setGroupBy(next);
        setExpanded(null);
    }, []);

    const toggle = useCallback((fingerprint: string) => {
        setExpanded((current) => (current === fingerprint ? null : fingerprint));
    }, []);

    let content;
    if (loading) {
        content = <LoadingSpinner/>;
    } else if (failed) {
        content = (
            <EmptyState
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.error.title'
                        defaultMessage='Health findings could not be loaded'
                    />
                }
                body={
                    <FormattedMessage
                        id='admin.health_dashboard.error.body'
                        defaultMessage='Reload the page to try again.'
                    />
                }
            />
        );
    } else if (lastEvaluatedAt === 0) {
        content = (
            <EmptyState
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.empty.title'
                        defaultMessage='Not evaluated yet'
                    />
                }
                body={
                    <FormattedMessage
                        id='admin.health_dashboard.empty.body'
                        defaultMessage='The first health check runs within an hour of enabling the feature.'
                    />
                }
            />
        );
    } else {
        const visible = filterHealthFindingsByTab(findings, tab, now);

        content = (
            <>
                <p className='HealthDashboard__lastEvaluated'>
                    <FormattedMessage
                        id='admin.health_dashboard.last_evaluated'
                        defaultMessage='Last evaluated {time}'
                        values={{time: <RelativeTime value={lastEvaluatedAt}/>}}
                    />
                </p>
                <div className='HealthDashboard__toolbar'>
                    <FindingTabs
                        idPrefix={idPrefix}
                        panelId={panelId}
                        active={tab}
                        counts={countHealthFindingsByTab(findings, now)}
                        onChange={changeTab}
                    />
                </div>
                <div className='HealthDashboard__toolbar HealthDashboard__toolbar--secondary'>
                    <GroupByControl
                        value={groupBy}
                        onChange={changeGroupBy}
                    />
                </div>
                <div
                    id={panelId}
                    role='tabpanel'
                    aria-labelledby={tabId(idPrefix, tab)}
                >
                    {visible.length === 0 ? (
                        <TabEmptyState tab={tab}/>
                    ) : (
                        <FindingGroups
                            key={tab}
                            findings={visible}
                            groupBy={groupBy}
                            tab={tab}
                            now={now}
                            expanded={expanded}
                            onToggle={toggle}
                        />
                    )}
                </div>
            </>
        );
    }

    return (
        <div className='wrapper--fixed HealthDashboard'>
            <AdminHeader>
                <FormattedMessage
                    id='admin.health_dashboard.title'
                    defaultMessage='Site health'
                />
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    {content}
                </div>
            </div>
        </div>
    );
};

export default HealthDashboard;
