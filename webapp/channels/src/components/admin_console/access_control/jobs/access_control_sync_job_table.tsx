// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import type {JobType, JobTypeBase, Job} from '@mattermost/types/jobs';

import type {ActionResult} from 'mattermost-redux/types/actions';

import JobsTable from 'components/admin_console/jobs';

import {JobTypes} from 'utils/constants';

import JobDetailsModal from '../modals/job_details/job_details_modal';

import './access_control_sync_job_table.scss';

type Props = {
    actions: {
        createJob: (job: JobTypeBase) => Promise<ActionResult>;
        getJobsByType: (jobType: JobType) => void;
    };
};

export default function AccessControlSyncJobTable(props: Props): JSX.Element {
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Load jobs when component mounts
        props.actions.getJobsByType(JobTypes.ACCESS_CONTROL_SYNC);

        // Set up polling interval
        const interval = setInterval(() => {
            props.actions.getJobsByType(JobTypes.ACCESS_CONTROL_SYNC);
        }, 15000);

        return () => {
            clearInterval(interval);
        };
    }, [props.actions]);

    const handleCreateJob = async (e?: React.SyntheticEvent) => {
        e?.preventDefault();

        if (isSubmitting) {
            return;
        }

        setIsSubmitting(true);

        const job = {
            type: JobTypes.ACCESS_CONTROL_SYNC,
        };

        try {
            await props.actions.createJob(job);

            // Immediately fetch updated job list
            props.actions.getJobsByType(JobTypes.ACCESS_CONTROL_SYNC);
        } finally {
            // Reset submitting state after a short delay to prevent rapid re-clicks
            setTimeout(() => {
                setIsSubmitting(false);
            }, 1000);
        }
    };

    const handleRowClick = (job: Job) => {
        setSelectedJob(job);
        setShowModal(true);
    };

    const handleModalClose = () => {
        setShowModal(false);
        setSelectedJob(null);
    };

    return (
        <div className='AccessControlSyncJobTable'>
            <div className='policy-header'>
                <div className='policy-header-text'>
                    <h1>{'Access Control Sync Jobs'}</h1>
                    <p>{'Synchronize access control policies with system resources and permissions.'}</p>
                </div>
                <button
                    className='btn btn-primary'
                    onClick={handleCreateJob}
                    disabled={isSubmitting}
                >
                    <i className='icon icon-plus'/>
                    <span>{isSubmitting ? 'Running Job...' : 'Run Sync Job'}</span>
                </button>
            </div>
            <JobsTable
                perPage={5}
                jobType={JobTypes.ACCESS_CONTROL_SYNC}
                hideJobCreateButton={true}
                className={'job-table__access-control'}
                createJobButtonText={'Create Job'}
                disabled={false}
                createJobHelpText={<></>}
                onRowClick={handleRowClick}
            />
            {showModal && selectedJob && (
                <JobDetailsModal
                    job={selectedJob}
                    onExited={handleModalClose}
                />
            )}
        </div>
    );
}

