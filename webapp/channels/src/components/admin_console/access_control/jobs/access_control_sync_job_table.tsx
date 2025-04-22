// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {JobType, JobTypeBase} from '@mattermost/types/jobs';
import {ActionResult} from 'mattermost-redux/types/actions';

import JobsTable from 'components/admin_console/jobs';

import './access_control_sync_job_table.scss';

type Props = {
    actions: {
        createJob: (job: JobTypeBase) => Promise<ActionResult>;
    };
};

export default function AccessControlSyncJobTable(props: Props): JSX.Element {
    const disabled = false;

    const handleCreateJob = async (e?: React.SyntheticEvent) => {
        e?.preventDefault();
        const job = {
            type: 'access_control_sync' as JobType,
        };

        await props.actions.createJob(job);
    };

    return (
        <div className='AccessControlSyncJobTable'>
            <div className='policy-header'>
                <div className='policy-header-text'>
                    <h1>{'Access Control Sync Jobs'}</h1>
                </div>
                <button
                    className='btn btn-primary'
                    onClick={handleCreateJob}
                >
                    <i className='icon icon-plus'/>
                    <span>{'Run Sync Job'}</span>
                </button>
            </div>
            <JobsTable
                jobType={'access_control_sync' as JobType}
                hideJobCreateButton={true}
                className={'job-table__access-control'}
                createJobButtonText={'Create Job'}
                disabled={disabled}
                createJobHelpText={<></>}
            />
        </div>
    );
} 

