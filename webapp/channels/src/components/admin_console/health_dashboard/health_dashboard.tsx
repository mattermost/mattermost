// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useId, useRef, useState} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {BellOffOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
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

    // Jobs in the store by ID. job_updated WebSocket events keep the run the page follows up to date.
    jobs: Record<string, Job>;
    actions: {
        getHealthFindings: (filter?: HealthFindingFilter) => Promise<ActionResult<HealthFindingList>>;
        muteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
        unmuteHealthFinding: (fingerprint: string) => Promise<ActionResult>;
        createJob: (job: JobTypeBase) => Promise<ActionResult<Job>>;
        getJob: (id: string) => Promise<ActionResult<Job>>;
        getJobsByType: (type: JobType, page?: number, perPage?: number) => Promise<ActionResult<Job[]>>;
    };
};

// The run's job_updated WebSocket events report its progress. This slow re-read is a backstop for
// an event missed while the WebSocket was reconnecting.
export const HEALTH_CHECK_BACKSTOP_INTERVAL = 60 * 1000;

// A run in progress with no activity for this long belongs to a node that died mid-run; the server
// closes it as failed on the next run (health_check.StaleInProgressAfter).
const STALE_RUN_AFTER = 60 * 60 * 1000;

function isRunActive(job: Job): boolean {
    if (job.status === 'in_progress' && Date.now() - job.last_activity_at > STALE_RUN_AFTER) {
        return false;
    }
    return job.status === 'pending' || job.status === 'in_progress' || job.status === 'cancel_requested';
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

const HealthDashboard = ({findings, mutedFindings, lastEvaluatedAt, jobs, actions}: Props) => {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(Date.now);
    const [tab, setTab] = useState<HealthFindingTab>('open');
    const [groupBy, setGroupBy] = useState<GroupBy>('severity');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showMuted, setShowMuted] = useState(false);
    const [muteError, setMuteError] = useState<MessageDescriptor | null>(null);
    const [starting, setStarting] = useState(false);
    const [runId, setRunId] = useState<string | null>(null);
    const run = runId ? jobs[runId] : undefined;
    const [runError, setRunError] = useState<RunError | null>(null);

    // Runs this page has already reported. A job list fetched after a run finishes can still show
    // it in progress (it may come from a lagging replica), and that run must not be followed again.
    const finishedRunIds = useRef(new Set<string>());
    const idPrefix = useId();
    const panelId = `${idPrefix}-panel`;

    useEffect(() => {
        actions.getHealthFindings().then(({error}) => {
            setFailed(Boolean(error));
            setNow(Date.now());
            setLoading(false);
        });

        // Loads the latest run into the store, where the effect below picks it up if it is still going.
        actions.getJobsByType('health_check', 0, 1);
    }, [actions]);

    // Follows a run that is going while the page isn't following one, whoever started it: the run
    // found on page load, or one started later by another admin, mmctl or the scheduler, whose
    // job_updated events put it in the store. This also catches a run the page-load lookup missed
    // because it read a lagging replica.
    useEffect(() => {
        if (runId) {
            return;
        }
        let newest: Job | undefined;
        for (const job of Object.values(jobs)) {
            if (job.type === 'health_check' && !finishedRunIds.current.has(job.id) && isRunActive(job) && (!newest || job.create_at > newest.create_at)) {
                newest = job;
            }
        }
        if (newest) {
            setRunId(newest.id);
        }
    }, [runId, jobs]);

    // Reports a finished run: fresh findings on success, the job's error otherwise. A failed reload
    // keeps the findings on screen rather than replacing the page with the load error.
    const finishRun = useCallback(async (job: Job) => {
        if (job.status !== 'success' && job.status !== 'warning') {
            const error = job.data?.error;
            setRunError(typeof error === 'string' && error ? {message: runFailedMessage, values: {error}} : {message: runFailedNoReasonMessage});
            return;
        }
        const {error} = await actions.getHealthFindings();
        if (error) {
            setRunError({message: runReloadErrorMessage});
            return;
        }
        setFailed(false);
        setNow(Date.now());
    }, [actions]);

    // Reports the run being followed once it has finished. The store copy is updated by its
    // job_updated events, by startRun and by the backstop below.
    useEffect(() => {
        if (run && !isRunActive(run)) {
            finishedRunIds.current.add(run.id);
            setRunId(null);
            finishRun(run);
        }
    }, [run, finishRun]);

    // Re-reads the run now and then while it is followed, in case an event was missed. A failed
    // read waits for the next event or the next re-read.
    useEffect(() => {
        if (!runId) {
            return undefined;
        }
        const timer = setInterval(() => actions.getJob(runId), HEALTH_CHECK_BACKSTOP_INTERVAL);
        return () => clearInterval(timer);
    }, [runId, actions]);

    const startRun = useCallback(async () => {
        setStarting(true);
        setRunError(null);
        const {data, error} = await actions.createJob({type: 'health_check'});
        setStarting(false);

        if (error || !data) {
            setRunError({message: runStartErrorMessage});
        } else {
            setRunId(data.id);
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

    const running = starting || runId !== null;
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
    const runErrorBanner = runError && (
        <AlertBanner
            mode='danger'
            className='HealthDashboard__runError'
            onDismiss={() => setRunError(null)}
            message={
                <FormattedMessage
                    {...runError.message}
                    values={runError.values}
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
            <>
                <div className='HealthDashboard__summary HealthDashboard__summary--end'>
                    {runButton}
                </div>
                {runErrorBanner}
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
                    {runButton}
                </div>
                {runErrorBanner}
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
