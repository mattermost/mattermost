// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useId, useMemo, useState} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {BellOffOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {EmptyState} from '@mattermost/compass-ui/components/empty-state';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';
import type {Job, JobType, JobTypeBase} from '@mattermost/types/jobs';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {
    countHealthFindingsByTab,
    filterHealthFindingsByTab,
} from 'mattermost-redux/utils/health_utils';
import type {HealthFindingTab} from 'mattermost-redux/utils/health_utils';

import AlertBanner from 'components/alert_banner';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {useWebSocketClient} from 'utils/use_websocket/hooks';

import {TabEmptyState} from './empty_state';
import ExportMenu from './export_menu';
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

    // Whether the viewer has manage_system, which exporting the findings needs.
    canManage: boolean;

    // Jobs in the store by ID. job_updated WebSocket events keep them up to date.
    jobs: Record<string, Job>;
    actions: {
        getHealthFindings: (filter?: HealthFindingFilter) => Promise<ActionResult<HealthFindingList>>;
        muteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
        unmuteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
        createJob: (job: JobTypeBase) => Promise<ActionResult<Job>>;
        getJobsByType: (type: JobType, page?: number, perPage?: number) => Promise<ActionResult<Job[]>>;
    };
};

// A run in progress with no activity for this long belongs to a node that died mid-run; the server
// closes it as failed on the next run (health_check.StaleInProgressAfter).
const STALE_RUN_AFTER = 15 * 60 * 1000;

function isRunActive(job: Job): boolean {
    if (job.status === 'in_progress' && Date.now() - job.last_activity_at > STALE_RUN_AFTER) {
        return false;
    }
    return job.status === 'pending' || job.status === 'in_progress';
}

function isRunSuccess(job: Job): boolean {
    return job.status === 'success' || job.status === 'warning';
}

function newestRun(jobs: Record<string, Job>): Job | undefined {
    let newest: Job | undefined;
    for (const job of Object.values(jobs)) {
        if (job.type === 'health_check' && (!newest || job.create_at > newest.create_at)) {
            newest = job;
        }
    }
    return newest;
}

const runStartErrorMessage = defineMessage({
    id: 'admin.health_dashboard.run.start_error',
    defaultMessage: 'The health check could not be started. Try again.',
});

const runReloadErrorMessage = defineMessage({
    id: 'admin.health_dashboard.run.reload_error',
    defaultMessage: 'The health check results could not be loaded. Reload the page to see them.',
});

const runFailedMessage = defineMessage({
    id: 'admin.health_dashboard.run.failed',
    // eslint-disable-next-line formatjs/enforce-placeholders -- error is provided where the banner renders it
    defaultMessage: 'The health check failed: {error}',
});

const runFailedNoReasonMessage = defineMessage({
    id: 'admin.health_dashboard.run.failed_no_reason',
    defaultMessage: 'The health check did not finish.',
});

type RunError = {
    message: MessageDescriptor;
    values?: Record<string, string>;
};

const muteErrorMessage = defineMessage({
    id: 'admin.health_dashboard.mute.error',
    defaultMessage: 'The finding could not be muted, so it is still in the open list. Try again.',
});

const unmuteErrorMessage = defineMessage({
    id: 'admin.health_dashboard.unmute.error',
    defaultMessage: 'The finding could not be unmuted, so it is still muted. Try again.',
});

const exportErrorMessage = defineMessage({
    id: 'admin.health_dashboard.export.error',
    defaultMessage: 'The health findings could not be exported. Try again.',
});

const HealthDashboard = ({findings, mutedFindings, lastEvaluatedAt, canManage, jobs, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [tab, setTab] = useState<HealthFindingTab>('open');
    const [groupBy, setGroupBy] = useState<GroupBy>('severity');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showMuted, setShowMuted] = useState(false);
    const [muteError, setMuteError] = useState<MessageDescriptor | null>(null);
    const [starting, setStarting] = useState(false);
    const [runError, setRunError] = useState<MessageDescriptor | null>(null);
    const [exportFailed, setExportFailed] = useState(false);
    const [dismissedRunId, setDismissedRunId] = useState<string | null>(null);
    const [, setStaleCheck] = useState(0);
    const wsClient = useWebSocketClient();
    const idPrefix = useId();
    const panelId = `${idPrefix}-panel`;

    useEffect(() => {
        actions.getHealthFindings().then(({error}) => {
            setFailed(Boolean(error));
            setNow(Date.now());
            setLoading(false);
        });
    }, [actions]);

    // Loads the newest run into the store, where job_updated events keep it current. It is loaded
    // again after a reconnect, because events missed while the WebSocket was down aren't always
    // replayed.
    useEffect(() => {
        const loadNewestRun = () => actions.getJobsByType('health_check', 0, 1);
        loadNewestRun();
        wsClient.addReconnectListener(loadNewestRun);
        return () => wsClient.removeReconnectListener(loadNewestRun);
    }, [wsClient, actions]);

    // The newest run counts only while the findings on screen don't reflect it yet. Once a run
    // succeeds and the findings are reloaded, lastEvaluatedAt is when it finished, which is after
    // it was created, so neither it nor an outdated copy of it counts any more.
    const latest = useMemo(() => newestRun(jobs), [jobs]);
    const run = !loading && !failed && latest && latest.create_at > lastEvaluatedAt ? latest : undefined;
    const running = starting || (run !== undefined && isRunActive(run));
    const failedRun = run && !isRunActive(run) && !isRunSuccess(run) ? run : undefined;

    // Reloads the findings once the run succeeds. A failed reload keeps the findings on screen
    // rather than replacing the page with the load error.
    const succeededRunId = run && isRunSuccess(run) ? run.id : undefined;
    useEffect(() => {
        if (!succeededRunId) {
            return;
        }
        actions.getHealthFindings().then(({error}) => {
            setRunError(error ? runReloadErrorMessage : null);
            if (!error) {
                setNow(Date.now());
            }
        });
    }, [succeededRunId, actions]);

    // A run whose node died sends no more events, so re-render when it turns stale: it then stops
    // showing as running and shows as not finished.
    const staleAt = run?.status === 'in_progress' ? run.last_activity_at + STALE_RUN_AFTER : 0;
    useEffect(() => {
        if (!staleAt) {
            return undefined;
        }
        const timer = setTimeout(() => setStaleCheck(staleAt), Math.max(staleAt - Date.now(), 0) + 1);
        return () => clearTimeout(timer);
    }, [staleAt]);

    const startRun = useCallback(async () => {
        setStarting(true);
        setRunError(null);
        const {error} = await actions.createJob({type: 'health_check'});
        setStarting(false);
        if (error) {
            setRunError(runStartErrorMessage);
        }
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

    const runButton = (
        <Button
            emphasis='secondary'
            size='small'
            loading={running}
            disabled={running}
            aria-busy={running}
            leadingIcon={<Icon glyph={<RefreshIcon/>}/>}
            onClick={startRun}
        >
            {running ? (
                <FormattedMessage
                    id='admin.health_dashboard.run.running'
                    defaultMessage='Running checks…'
                />
            ) : (
                <FormattedMessage
                    id='admin.health_dashboard.run.button'
                    defaultMessage='Re-run checks'
                />
            )}
        </Button>
    );
    let banner: RunError | undefined;
    if (runError) {
        banner = {message: runError};
    } else if (failedRun && failedRun.id !== dismissedRunId) {
        const error = failedRun.data?.error;
        banner = typeof error === 'string' && error ? {message: runFailedMessage, values: {error}} : {message: runFailedNoReasonMessage};
    }
    const runErrorBanner = banner && (
        <AlertBanner
            mode='danger'
            className='HealthDashboard__runError'
            onDismiss={() => {
                setRunError(null);
                setDismissedRunId(failedRun?.id ?? null);
            }}
            message={
                <FormattedMessage
                    {...banner.message}
                    values={banner.values}
                />
            }
        />
    );

    let content;
    if (loading) {
        content = <LoadingSpinner/>;
    } else if (failed) {
        content = (
            <EmptyState
                className='HealthDashboard__empty'
                title={
                    <FormattedMessage
                        id='admin.health_dashboard.error.title'
                        defaultMessage='Health findings could not be loaded'
                    />
                }
                description={
                    <FormattedMessage
                        id='admin.health_dashboard.error.body'
                        defaultMessage='Reload the page to try again.'
                    />
                }
            />
        );
    } else if (lastEvaluatedAt === 0) {
        content = (
            <>
                <div className='HealthDashboard__summary HealthDashboard__summary--end'>
                    {runButton}
                </div>
                {runErrorBanner}
                <EmptyState
                    className='HealthDashboard__empty'
                    title={
                        <FormattedMessage
                            id='admin.health_dashboard.empty.title'
                            defaultMessage='Not evaluated yet'
                        />
                    }
                    description={
                        <FormattedMessage
                            id='admin.health_dashboard.empty.body'
                            defaultMessage='The first health check runs within an hour of enabling the feature. To run it now, select Re-run checks.'
                        />
                    }
                />
            </>
        );
    } else {
        const visible = filterHealthFindingsByTab(findings, tab, now);

        content = (
            <>
                <div className='HealthDashboard__summary'>
                    <p className='HealthDashboard__lastEvaluated'>
                        <FormattedMessage
                            id='admin.health_dashboard.last_evaluated'
                            defaultMessage='Last evaluated {time}'
                            values={{time: <RelativeTime value={lastEvaluatedAt}/>}}
                        />
                    </p>
                    <div className='HealthDashboard__actions'>
                        {runButton}
                        {canManage && <ExportMenu onError={setExportFailed}/>}
                    </div>
                </div>
                {runErrorBanner}
                {exportFailed && (
                    <AlertBanner
                        mode='danger'
                        className='HealthDashboard__exportError'
                        onDismiss={() => setExportFailed(false)}
                        message={<FormattedMessage {...exportErrorMessage}/>}
                    />
                )}
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
