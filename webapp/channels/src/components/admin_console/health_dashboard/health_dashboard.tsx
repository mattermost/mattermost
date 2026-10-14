// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useId, useState} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {BellOffOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {
    countHealthFindingsByTab,
    filterHealthFindingsByTab,
} from 'mattermost-redux/utils/health_utils';
import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

import AlertBanner from 'components/alert_banner';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {EmptyState, TabEmptyState} from './empty_state';
import FindingGroups from './finding_groups';
import FindingTabs, {tabId} from './finding_tabs';
import GroupByControl from './group_by_control';
import type {GroupBy} from './group_by_control';
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

const muteErrorMessage = defineMessage({
    id: 'admin.health_dashboard.mute.error',
    defaultMessage: 'The finding could not be muted, so it is still in the open list. Try again.',
});

const unmuteErrorMessage = defineMessage({
    id: 'admin.health_dashboard.unmute.error',
    defaultMessage: 'The finding could not be unmuted, so it is still muted. Try again.',
});

const HealthDashboard = ({findings, mutedFindings, lastEvaluatedAt, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [tab, setTab] = useState<HealthFindingTab>('open');
    const [groupBy, setGroupBy] = useState<GroupBy>('severity');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showMuted, setShowMuted] = useState(false);
    const [muteError, setMuteError] = useState<MessageDescriptor | null>(null);
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

    const mute = useCallback(async (fingerprint: string) => {
        const {error} = await actions.muteHealthFinding(fingerprint);
        setMuteError(error ? muteErrorMessage : null);
    }, [actions]);

    const unmute = useCallback(async (fingerprint: string) => {
        const {error} = await actions.unmuteHealthFinding(fingerprint);
        setMuteError(error ? unmuteErrorMessage : null);
    }, [actions]);

    const rowState = {now, expanded, onToggle: toggle, onMute: mute, onUnmute: unmute};

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
                <div className='HealthDashboard__toolbar HealthDashboard__toolbar--secondary'>
                    <GroupByControl
                        value={groupBy}
                        onChange={changeGroupBy}
                    />
                </div>
                {muteError && (
                    <AlertBanner
                        mode='danger'
                        className='HealthDashboard__muteError'
                        onDismiss={() => setMuteError(null)}
                        message={<FormattedMessage {...muteError}/>}
                    />
                )}
                {showMuted ? (
                    <MutedFindings
                        findings={mutedFindings}
                        groupBy={groupBy}
                        {...rowState}
                    />
                ) : (
                    <div
                        id={panelId}
                        role='tabpanel'
                        aria-labelledby={tabId(idPrefix, tab)}
                    >
                        {visible.length === 0 ? (
                            <TabEmptyState
                                tab={tab}
                                muted={filterHealthFindingsByTab(mutedFindings, tab, now).length}
                            />
                        ) : (
                            <FindingGroups
                                key={tab}
                                findings={visible}
                                groupBy={groupBy}
                                expandAll={tab !== 'open'}
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
        </div>
    );
};

export default HealthDashboard;
