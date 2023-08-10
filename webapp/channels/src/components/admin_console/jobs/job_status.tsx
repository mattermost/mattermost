// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {JobStatuses} from 'utils/constants';

import type {Job} from '@mattermost/types/jobs';

const JobStatus = React.memo(({job}: {job: Job}) => {
    const intl = useIntl();
    if (job.status === JobStatuses.PENDING) {
        return (
            <span
                className='JobStatus status-icon-warning'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusPending'
                    defaultMessage='Pending'
                />
            </span>
        );
    } else if (job.status === JobStatuses.IN_PROGRESS) {
        return (
            <span
                className='JobStatus status-icon-warning'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusInProgress'
                    defaultMessage='In Progress'
                />
            </span>
        );
    } else if (job.status === JobStatuses.SUCCESS) {
        return (
            <span
                className='JobStatus status-icon-success'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusSuccess'
                    defaultMessage='Success'
                />
            </span>
        );
    } else if (job.status === JobStatuses.WARNING) {
        return (
            <span
                className='JobStatus status-icon-warning'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusWarning'
                    defaultMessage='Warning'
                />
            </span>
        );
    } else if (job.status === JobStatuses.ERROR) {
        return (
            <span
                className='JobStatus status-icon-error'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusError'
                    defaultMessage='Error'
                />
            </span>
        );
    } else if (job.status === JobStatuses.CANCEL_REQUESTED) {
        return (
            <span
                className='JobStatus status-icon-warning'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusCanceling'
                    defaultMessage='Canceling...'
                />
            </span>
        );
    } else if (job.status === JobStatuses.CANCELED) {
        return (
            <span
                className='JobStatus status-icon-error'
                title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
            >
                <FormattedMessage
                    id='admin.jobTable.statusCanceled'
                    defaultMessage='Canceled'
                />
            </span>
        );
    }

    return (
        <span
            className='JobStatus'
            title={intl.formatMessage({id: 'admin.jobTable.jobId', defaultMessage: 'Job ID: '}) + job.id}
        >
            {job.status}
        </span>
    );
});

export default JobStatus;
