// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useId, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {
    countHealthFindingsByTab,
    filterHealthFindingsByTab,
    groupHealthFindingsByArea,
    groupHealthFindingsBySection,
} from 'mattermost-redux/utils/health_utils';
import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

import AlertBanner from 'components/alert_banner';
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
import MuteConfirmModal from './mute_confirm_modal';
import MutedFindings from './muted_findings';
import RelativeTime from './relative_time';

import './health_dashboard.scss';

export type Props = {
    findings: HealthFinding[];
    mutedFindings: HealthFinding[];
    lastEvaluatedAt: number;
    actions: {
        getHealthFindings: (filter?: HealthFindingFilter) => Promise<ActionResult<HealthFindingList>>;
        muteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
        unmuteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
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

const HealthDashboard = ({findings, mutedFindings, lastEvaluatedAt, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [tab, setTab] = useState<HealthFindingTab>('open');
    const [groupBy, setGroupBy] = useState<GroupBy>('severity');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showMuted, setShowMuted] = useState(false);
    const [confirmingMute, setConfirmingMute] = useState<HealthFinding | null>(null);
    const [muteError, setMuteError] = useState<'mute' | 'unmute' | null>(null);
    const idPrefix = useId();
    const panelId = `${idPrefix}-panel`;

    useEffect(() => {
        actions.getHealthFindings({muted: 'included'}).then(({error}) => {
            setFailed(Boolean(error));
            setNow(Date.now());
            setLoading(false);
        });
    }, [actions]);

    const changeTab = useCallback((next: HealthFindingTab) => {
        setTab(next);
        setShowMuted(false);
        setExpanded(null);
    }, []);

    const toggleMuted = useCallback(() => {
        setShowMuted((current) => !current);
        setExpanded(null);
    }, []);

    const changeGroupBy = useCallback((next: GroupBy) => {
        setGroupBy(next);
        setExpanded(null);
    }, []);

    const toggle = useCallback((fingerprint: string) => {
        setExpanded((current) => (current === fingerprint ? null : fingerprint));
    }, []);

    const requestMute = useCallback((fingerprint: string) => {
        setConfirmingMute(findings.find((finding) => finding.fingerprint === fingerprint) ?? null);
    }, [findings]);

    const mute = useCallback(async (fingerprint: string) => {
        const {error} = await actions.muteHealthFinding(fingerprint);
        setMuteError(error ? 'mute' : null);
    }, [actions]);

    const unmute = useCallback(async (fingerprint: string) => {
        const {error} = await actions.unmuteHealthFinding(fingerprint);
        setMuteError(error ? 'unmute' : null);
    }, [actions]);

    const rowState = {now, expanded, onToggle: toggle, onMute: requestMute, onUnmute: unmute};

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
                        active={showMuted ? null : tab}
                        counts={countHealthFindingsByTab(findings, now)}
                        onChange={changeTab}
                    />
                    <button
                        type='button'
                        className={classNames('HealthDashboard__mutedToggle', {'HealthDashboard__mutedToggle--active': showMuted})}
                        aria-pressed={showMuted}
                        onClick={toggleMuted}
                    >
                        <BellOffOutlineIcon
                            size={16}
                            color='currentColor'
                            aria-hidden={true}
                        />
                        <FormattedMessage
                            id='admin.health_dashboard.muted.toggle'
                            defaultMessage='Muted'
                        />
                        <span className='HealthDashboard__tabCount'>{mutedFindings.length}</span>
                    </button>
                </div>
                {!showMuted && (
                    <div className='HealthDashboard__toolbar HealthDashboard__toolbar--secondary'>
                        <GroupByControl
                            value={groupBy}
                            onChange={changeGroupBy}
                        />
                    </div>
                )}
                {muteError && (
                    <AlertBanner
                        mode='danger'
                        className='HealthDashboard__muteError'
                        onDismiss={() => setMuteError(null)}
                        message={muteError === 'mute' ? (
                            <FormattedMessage
                                id='admin.health_dashboard.mute.error'
                                defaultMessage='The finding could not be muted, so it is still in the open list. Try again.'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.health_dashboard.unmute.error'
                                defaultMessage='The finding could not be unmuted, so it is still muted. Try again.'
                            />
                        )}
                    />
                )}
                {showMuted ? (
                    <MutedFindings
                        findings={mutedFindings}
                        {...rowState}
                    />
                ) : (
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
                                {...rowState}
                            />
                        )}
                    </div>
                )}
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
            {confirmingMute && (
                <MuteConfirmModal
                    finding={confirmingMute}
                    onConfirm={mute}
                    onExited={() => setConfirmingMute(null)}
                />
            )}
        </div>
    );
};

export default HealthDashboard;
