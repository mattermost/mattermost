// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useId, useState} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {BellOffOutlineIcon, RefreshIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding, HealthFindingFilter, HealthFindingList} from '@mattermost/types/health';
import type {Job} from '@mattermost/types/jobs';

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
        startHealthCheckRun: () => Promise<ActionResult<Job>>;
        getHealthCheckRun: () => Promise<ActionResult<Job | null>>;
    };
};

// How often a run's status is checked while it runs. A run is picked up within about 15 seconds
// and then takes seconds to a minute or two, so this keeps the page responsive without much load.
export const HEALTH_CHECK_POLL_INTERVAL = 3000;

function isRunActive(job: Job): boolean {
    return job.status === 'pending' || job.status === 'in_progress' || job.status === 'cancel_requested';
}

function isRunSuccessful(job: Job): boolean {
    return job.status === 'success' || job.status === 'warning';
}

// The status endpoint returns the newest run. One older than the run being followed means the
// server read a lagging replica, so keep following ours; a newer one only starts once ours has
// finished, and its result is the freshest.
function followRun(current: Job, latest: Job | null): Job {
    if (!latest || latest.create_at < current.create_at) {
        return current;
    }
    return latest;
}

type RunError = {
    message: MessageDescriptor;
    values?: Record<string, string>;
};

const runStartErrorMessage = defineMessage({
    id: 'admin.health_dashboard.run.start_error',
    defaultMessage: 'The health check could not be started. Try again.',
});

const runStatusErrorMessage = defineMessage({
    id: 'admin.health_dashboard.run.status_error',
    defaultMessage: 'The health check is running, but its progress could not be checked. Reload the page to see its results.',
});

const runReloadErrorMessage = defineMessage({
    id: 'admin.health_dashboard.run.reload_error',
    defaultMessage: 'The health check finished, but its findings could not be loaded. Reload the page to see them.',
});

const runFailedMessage = defineMessage({
    id: 'admin.health_dashboard.run.failed',
    // eslint-disable-next-line formatjs/enforce-placeholders -- error is provided where the banner renders it
    defaultMessage: 'The health check failed: {error}',
});

const runFailedNoReasonMessage = defineMessage({
    id: 'admin.health_dashboard.run.failed_no_reason',
    defaultMessage: 'The health check failed.',
});

const runCanceledMessage = defineMessage({
    id: 'admin.health_dashboard.run.canceled',
    defaultMessage: 'The health check was canceled before it finished.',
});

function runErrorFor(job: Job): RunError {
    if (job.status === 'canceled') {
        return {message: runCanceledMessage};
    }
    const error = job.data?.error;
    if (typeof error === 'string' && error !== '') {
        return {message: runFailedMessage, values: {error}};
    }
    return {message: runFailedNoReasonMessage};
}

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
    const [starting, setStarting] = useState(false);
    const [activeRun, setActiveRun] = useState<Job | null>(null);
    const [runError, setRunError] = useState<RunError | null>(null);
    const idPrefix = useId();
    const panelId = `${idPrefix}-panel`;

    useEffect(() => {
        actions.getHealthFindings().then(({error}) => {
            setFailed(Boolean(error));
            setNow(Date.now());
            setLoading(false);
        });

        // Pick up a run that is already going, whoever started it, so the page shows it running.
        actions.getHealthCheckRun().then(({data}) => {
            if (data && isRunActive(data)) {
                setActiveRun((current) => current ?? data);
            }
        });
    }, [actions]);

    // Reports a finished run: fresh findings on success, the job's error otherwise.
    const finishRun = useCallback(async (job: Job) => {
        if (isRunSuccessful(job)) {
            // Keep the findings already on screen if the reload fails, rather than replacing the
            // whole page with the load error: the run itself succeeded.
            const {error} = await actions.getHealthFindings();
            if (error) {
                setRunError({message: runReloadErrorMessage});
                return;
            }
            setFailed(false);
            setNow(Date.now());
        } else {
            setRunError(runErrorFor(job));
        }
    }, [actions]);

    // Polls the run being followed until it finishes. Unmounting, or following another run,
    // stops the loop.
    useEffect(() => {
        if (!activeRun) {
            return undefined;
        }

        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        let current = activeRun;

        const poll = async () => {
            const {data, error} = await actions.getHealthCheckRun();
            if (stopped) {
                return;
            }
            if (error) {
                setRunError({message: runStatusErrorMessage});
                setActiveRun(null);
                return;
            }

            current = followRun(current, data ?? null);
            if (isRunActive(current)) {
                timer = setTimeout(poll, HEALTH_CHECK_POLL_INTERVAL);
                return;
            }

            await finishRun(current);
            if (!stopped) {
                setActiveRun(null);
            }
        };
        timer = setTimeout(poll, HEALTH_CHECK_POLL_INTERVAL);

        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [activeRun, actions, finishRun]);

    const startRun = useCallback(async () => {
        setStarting(true);
        setRunError(null);
        const {data, error} = await actions.startHealthCheckRun();
        setStarting(false);

        if (error || !data) {
            setRunError({message: runStartErrorMessage});
            return;
        }
        if (isRunActive(data)) {
            setActiveRun(data);
            return;
        }
        await finishRun(data);
    }, [actions, finishRun]);

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

    const running = starting || activeRun !== null;
    const runButton = (
        <button
            type='button'
            className={classNames('btn btn-secondary btn-sm HealthDashboard__rerun', {'HealthDashboard__rerun--running': running})}
            disabled={running}
            aria-busy={running}
            onClick={startRun}
        >
            <RefreshIcon
                size={16}
                color='currentColor'
                aria-hidden={true}
            />
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
        </button>
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
