// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {JobStatuses} from 'utils/constants';

import type {Job} from '@mattermost/types/jobs';

const JobRunLength = React.memo(({job}: {job: Job}): JSX.Element => {
    const intl = useIntl();
    let millis = job.last_activity_at - job.start_at;
    if (job.status === JobStatuses.IN_PROGRESS) {
        const runningMillis = Date.now() - job.start_at;
        if (runningMillis > millis) {
            millis = runningMillis;
        }
    }

    let lastActivity = intl.formatMessage({id: 'admin.jobTable.lastActivityAt', defaultMessage: 'Last Activity: '}) + '--';

    if (job.last_activity_at > 0) {
        lastActivity = intl.formatMessage({id: 'admin.jobTable.lastActivityAt', defaultMessage: 'Last Activity: '}) +
            intl.formatDate(new Date(job.last_activity_at), {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
            }) + ' - ' +
            intl.formatTime(new Date(job.last_activity_at), {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
    }

    const seconds = Math.round(millis / 1000);
    const minutes = Math.round(millis / (1000 * 60));

    if (millis <= 0 || job.status === JobStatuses.CANCELED) {
        return (
            <span className='JobRunLength whitespace--nowrap'>{'--'}</span>
        );
    }

    if (seconds <= 120) {
        return (
            <span
                className='JobRunLength whitespace--nowrap'
                title={lastActivity}
            >
                {seconds + intl.formatMessage({id: 'admin.jobTable.runLengthSeconds', defaultMessage: ' seconds'})}
            </span>
        );
    }

    return (
        <span
            className='JobRunLength whitespace--nowrap'
            title={lastActivity}
        >
            {minutes + intl.formatMessage({id: 'admin.jobTable.runLengthMinutes', defaultMessage: ' minutes'})}
        </span>
    );
});

export default JobRunLength;
