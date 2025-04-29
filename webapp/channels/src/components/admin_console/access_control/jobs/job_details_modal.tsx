// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {Job} from '@mattermost/types/jobs';

import './job_details_modal.scss';

type Props = {
    job: Job | null;
    onExited: () => void;
};

export default function JobDetailsModal({job, onExited}: Props): JSX.Element {
    if (!job) {
        return (
            <GenericModal
                onExited={onExited}
                modalHeaderText='Job Details'
                show={true}
            >
                <div className='JobDetailsModal'>
                    <p>
                        <FormattedMessage
                            id='admin.jobTable.details.noJobSelected'
                            defaultMessage='No job selected'
                        />
                    </p>
                </div>
            </GenericModal>
        );
    }

    const createDate = new Date(job.create_at);
    const startDate = job.start_at ? new Date(job.start_at) : null;
    const lastActivityDate = job.last_activity_at ? new Date(job.last_activity_at) : null;

    return (
        <GenericModal
            onExited={onExited}
            modalHeaderText={
                <FormattedMessage
                    id='admin.jobTable.details.title'
                    defaultMessage='Job Details - {jobId}'
                    values={{
                        jobId: job.id,
                    }}
                />
            }
            show={true}
        >
            <div className='JobDetailsModal'>
                <div className='details-row'>
                    <div className='details-label'>
                        <FormattedMessage
                            id='admin.jobTable.details.jobId'
                            defaultMessage='Job ID:'
                        />
                    </div>
                    <div className='details-value'>{job.id}</div>
                </div>
                <div className='details-row'>
                    <div className='details-label'>
                        <FormattedMessage
                            id='admin.jobTable.details.jobType'
                            defaultMessage='Type:'
                        />
                    </div>
                    <div className='details-value'>{job.type}</div>
                </div>
                <div className='details-row'>
                    <div className='details-label'>
                        <FormattedMessage
                            id='admin.jobTable.details.status'
                            defaultMessage='Status:'
                        />
                    </div>
                    <div className='details-value'>{job.status}</div>
                </div>
                <div className='details-row'>
                    <div className='details-label'>
                        <FormattedMessage
                            id='admin.jobTable.details.createAt'
                            defaultMessage='Created:'
                        />
                    </div>
                    <div className='details-value'>
                        <FormattedDate value={createDate}/> <FormattedTime value={createDate}/>
                    </div>
                </div>
                {startDate && (
                    <div className='details-row'>
                        <div className='details-label'>
                            <FormattedMessage
                                id='admin.jobTable.details.startAt'
                                defaultMessage='Started:'
                            />
                        </div>
                        <div className='details-value'>
                            <FormattedDate value={startDate}/> <FormattedTime value={startDate}/>
                        </div>
                    </div>
                )}
                {lastActivityDate && (
                    <div className='details-row'>
                        <div className='details-label'>
                            <FormattedMessage
                                id='admin.jobTable.details.lastActivityAt'
                                defaultMessage='Last Activity:'
                            />
                        </div>
                        <div className='details-value'>
                            <FormattedDate value={lastActivityDate}/> <FormattedTime value={lastActivityDate}/>
                        </div>
                    </div>
                )}
                <div className='details-row'>
                    <div className='details-label'>
                        <FormattedMessage
                            id='admin.jobTable.details.progress'
                            defaultMessage='Progress:'
                        />
                    </div>
                    <div className='details-value'>{job.progress}</div>
                </div>
                {job.data && Object.keys(job.data).length > 0 && (
                    <div className='details-row'>
                        <div className='details-label'>
                            <FormattedMessage
                                id='admin.jobTable.details.data'
                                defaultMessage='Data:'
                            />
                        </div>
                        <div className='details-value'>
                            <pre>{JSON.stringify(job.data, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
}
