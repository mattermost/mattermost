// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Job, JobType} from '@mattermost/types/jobs';

import {createAccessControlSyncJob} from 'mattermost-redux/actions/access_control';
import {getJobsByType} from 'mattermost-redux/actions/jobs';

import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './sync_status_footer.scss';

const JOB_TYPE_ACCESS_CONTROL_SYNC = 'access_control_sync' as JobType;
const JOB_STATUS_SUCCESS = 'success';
const JOBS_PER_PAGE = 10;
const POLL_INTERVAL_MS = 3000;
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

type Props = {
    teamId: string;
    hasPolicies: boolean;
};

function getRelativeTime(timestamp: number, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string {
    if (!timestamp) {
        return formatMessage({id: 'team_settings.sync_status.never', defaultMessage: 'Never synced.'});
    }

    const diffMs = Date.now() - timestamp;
    const diffMinutes = Math.floor(diffMs / MS_PER_MINUTE);

    if (diffMinutes < 1) {
        return formatMessage({id: 'team_settings.sync_status.just_now', defaultMessage: 'Last synced just now.'});
    }
    if (diffMinutes < MINUTES_PER_HOUR) {
        return formatMessage(
            {id: 'team_settings.sync_status.minutes_ago', defaultMessage: 'Last synced {count} {count, plural, one {minute} other {minutes}} ago.'},
            {count: diffMinutes},
        );
    }

    const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
    if (diffHours < HOURS_PER_DAY) {
        return formatMessage(
            {id: 'team_settings.sync_status.hours_ago', defaultMessage: 'Last synced {count} {count, plural, one {hour} other {hours}} ago.'},
            {count: diffHours},
        );
    }

    const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
    return formatMessage(
        {id: 'team_settings.sync_status.days_ago', defaultMessage: 'Last synced {count} {count, plural, one {day} other {days}} ago.'},
        {count: diffDays},
    );
}

export default function SyncStatusFooter({teamId, hasPolicies}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const [lastSyncedAt, setLastSyncedAt] = useState<number>(0);
    const [syncing, setSyncing] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fetchSyncStatus = useCallback(async () => {
        try {
            const result = await dispatch(getJobsByType(JOB_TYPE_ACCESS_CONTROL_SYNC, 0, JOBS_PER_PAGE, teamId));
            if (result.data) {
                const completedJob = (result.data as Job[]).find((job) => job.status === JOB_STATUS_SUCCESS);
                if (completedJob) {
                    setLastSyncedAt(completedJob.last_activity_at);
                }
            }
        } catch {
            // API may fail if the server hasn't been updated yet; show footer anyway and do nothing
        }
        setLoaded(true);
    }, [dispatch, teamId]);

    useEffect(() => {
        if (hasPolicies) {
            fetchSyncStatus();
        }
    }, [hasPolicies, fetchSyncStatus]);

    const handleSyncNow = useCallback(async () => {
        setSyncing(true);
        try {
            const result = await dispatch(createAccessControlSyncJob({team_id: teamId}));
            if (result.error) {
                setSyncing(false);
            }
        } catch {
            setSyncing(false);
        }
    }, [dispatch, teamId]);

    // Poll for sync completion while syncing.
    useEffect(() => {
        if (!syncing) {
            return undefined;
        }

        const interval = setInterval(async () => {
            const result = await dispatch(getJobsByType(JOB_TYPE_ACCESS_CONTROL_SYNC, 0, JOBS_PER_PAGE, teamId));
            if (result.error) {
                setSyncing(false);
                return;
            }
            if (result.data) {
                const completedJob = (result.data as Job[]).find((job) => job.status === JOB_STATUS_SUCCESS);
                if (completedJob && completedJob.last_activity_at > lastSyncedAt) {
                    setLastSyncedAt(completedJob.last_activity_at);
                    setSyncing(false);
                }
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [syncing, dispatch, teamId, lastSyncedAt]);

    if (!hasPolicies || !loaded) {
        return null;
    }

    const timeText = getRelativeTime(lastSyncedAt, formatMessage);

    return (
        <div className='SyncStatusFooter'>
            <i className='icon icon-information-outline SyncStatusFooter__icon'/>
            <span className='SyncStatusFooter__text'>
                {timeText}
            </span>
            {syncing ? (
                <>
                    <span className='SyncStatusFooter__syncing'>
                        {formatMessage({
                            id: 'team_settings.sync_status.syncing',
                            defaultMessage: 'Syncing...',
                        })}
                    </span>
                    <LoadingSpinner/>
                </>
            ) : (
                <button
                    className='style--none SyncStatusFooter__link'
                    onClick={handleSyncNow}
                >
                    {formatMessage({
                        id: 'team_settings.sync_status.sync_now',
                        defaultMessage: 'Sync now',
                    })}
                </button>
            )}
        </div>
    );
}
