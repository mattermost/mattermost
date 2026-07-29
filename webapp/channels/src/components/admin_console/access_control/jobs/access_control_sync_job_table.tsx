// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';
import type {JobType, JobTypeBase, Job} from '@mattermost/types/jobs';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {isTeamMembershipAccessControlEnabled} from 'selectors/general';

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

function renderButtonLabel(isSubmitting: boolean, teamAbacEnabled: boolean): JSX.Element {
    if (isSubmitting) {
        return (
            <FormattedMessage
                id='admin.access_control.sync_jobs.running'
                defaultMessage='Running Job...'
            />
        );
    }
    if (teamAbacEnabled) {
        return (
            <FormattedMessage
                id='admin.access_control.sync_jobs.run_channel'
                defaultMessage='Run Channel Sync'
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.access_control.sync_jobs.run'
            defaultMessage='Run Sync Job'
        />
    );
}

export default function AccessControlSyncJobTable(props: Props): JSX.Element {
    const {formatMessage} = useIntl();

    // This button only syncs channel membership; when team ABAC is on, name the
    // scope so a green success isn't mistaken for a team re-evaluation.
    const teamAbacEnabled = useSelector(isTeamMembershipAccessControlEnabled);

    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        props.actions.getJobsByType(JobTypes.ACCESS_CONTROL_SYNC);
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
                    <h1>
                        <FormattedMessage
                            id='admin.access_control.sync_jobs.title'
                            defaultMessage='Membership Sync Jobs'
                        />
                    </h1>
                    <p>
                        {teamAbacEnabled ? (
                            <FormattedMessage
                                id='admin.access_control.sync_jobs.description_channel_scope'
                                defaultMessage='Re-sync channel membership for channels assigned to a membership policy.'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.access_control.sync_jobs.description'
                                defaultMessage='Apply membership policies to their assigned resources.'
                            />
                        )}
                    </p>
                </div>
                <Button
                    emphasis='primary'
                    onClick={handleCreateJob}
                    disabled={isSubmitting}
                >
                    <i className='icon icon-plus'/>
                    <span>
                        {renderButtonLabel(isSubmitting, teamAbacEnabled)}
                    </span>
                </Button>
            </div>
            {teamAbacEnabled && (
                <div className='team-sync-note'>
                    <i className='icon icon-information-outline'/>
                    <span>
                        <FormattedMessage
                            id='admin.access_control.sync_jobs.team_sync_note'
                            defaultMessage='This runs a channel membership sync only. To re-sync team membership, use <b>Sync now</b> in Team Settings → Team Membership or the team’s page in the System Console.'
                            values={{b: (chunks: React.ReactNode) => <b>{chunks}</b>}}
                        />
                    </span>
                </div>
            )}
            <JobsTable
                perPage={5}
                jobType={JobTypes.ACCESS_CONTROL_SYNC}
                hideJobCreateButton={true}
                className={'job-table__access-control'}
                createJobButtonText={formatMessage({
                    id: 'admin.access_control.sync_jobs.create_job',
                    defaultMessage: 'Create Job',
                })}
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

