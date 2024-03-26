// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Job, JobType} from '@mattermost/types/jobs';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {JobTypes} from 'utils/constants';

import JobCancelButton from './job_cancel_button';
import JobDownloadLink from './job_download_link';
import JobFinishAt from './job_finish_at';
import JobRunLength from './job_run_length';
import JobStatus from './job_status';

import './table.scss';

export type Props = {
    jobs: Job[];
    getExtraInfoText?: (job: Job) => React.ReactNode;
    disabled: boolean;
    createJobHelpText: React.ReactElement;
    jobType: JobType;
    downloadExportResults?: boolean;
    className?: string;
    hideJobCreateButton?: boolean;
    createJobButtonText: React.ReactNode;
    hideTable?: boolean;
    jobData?: any;
    actions: {
        getJobsByType: (jobType: JobType) => void;
        cancelJob: (jobId: string) => Promise<ActionResult>;
        createJob: (job: {type: JobType}) => Promise<ActionResult>;
    };
}

class JobTable extends React.PureComponent<Props> {
    interval: ReturnType<typeof setInterval>|null = null;

    componentDidMount() {
        this.props.actions.getJobsByType(this.props.jobType);
        this.interval = setInterval(this.reload, 15000);
    }

    componentWillUnmount() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    getExtraInfoText = (job: Job) => {
        if (job.data && job.data.error && job.data.error.length > 0) {
            return <span title={job.data.error}>{job.data.error}</span>;
        }

        if (this.props.getExtraInfoText) {
            return this.props.getExtraInfoText(job);
        }

        return <span/>;
    };

    reload = () => {
        this.props.actions.getJobsByType(this.props.jobType);
    };

    handleCancelJob = async (jobId: string) => {
        await this.props.actions.cancelJob(jobId);
        this.reload();
    };

    handleCreateJob = async (e: React.MouseEvent) => {
        e.preventDefault();
        const job = {
            type: this.props.jobType,
            data: this.props.jobData,
        };

        await this.props.actions.createJob(job);
        this.reload();
    };

    render() {
        const showFilesColumn = this.props.jobType === JobTypes.MESSAGE_EXPORT && this.props.downloadExportResults;
        const items = this.props.jobs.map((job) => {
            return (
                <tr
                    key={job.id}
                >
                    <td className='cancel-button-field whitespace--nowrap text-center'>
                        <JobCancelButton
                            job={job}
                            onClick={this.handleCancelJob}
                            disabled={this.props.disabled}
                        />
                    </td>
                    <td className='whitespace--nowrap'><JobStatus job={job}/></td>
                    {showFilesColumn &&
                        <td className='whitespace--nowrap'><JobDownloadLink job={job}/></td>
                    }
                    <td className='whitespace--nowrap'>
                        <JobFinishAt
                            status={job.status}
                            millis={job.last_activity_at}
                        />
                    </td>
                    <td className='whitespace--nowrap'><JobRunLength job={job}/></td>
                    <td>{this.getExtraInfoText(job)}</td>
                </tr>
            );
        });

        return (
            <div className={classNames('JobTable', 'job-table__panel', this.props.className)}>
                <div className='job-table__create-button'>
                    {
                        !this.props.hideJobCreateButton &&
                        <div>
                            <button
                                type='button'
                                className='btn btn-tertiary'
                                onClick={this.handleCreateJob}
                                disabled={this.props.disabled}
                            >
                                {this.props.createJobButtonText}
                            </button>
                        </div>
                    }
                    <div className='help-text'>
                        {this.props.createJobHelpText}
                    </div>
                </div>
                {
                    !this.props.hideTable &&
                    <div className='job-table__table'>
                        <table
                            className='table'
                            data-testid='jobTable'
                        >
                            <thead>
                                <tr>
                                    <th className='cancel-button-field'/>
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerStatus'
                                            defaultMessage='Status'
                                        />
                                    </th>
                                    {showFilesColumn &&
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerFiles'
                                            defaultMessage='Files'
                                        />
                                    </th>
                                    }
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerFinishAt'
                                            defaultMessage='Finish Time'
                                        />
                                    </th>
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerRunTime'
                                            defaultMessage='Run Time'
                                        />
                                    </th>
                                    <th colSpan={3}>
                                        <FormattedMessage
                                            id='admin.jobTable.headerExtraInfo'
                                            defaultMessage='Details'
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items}
                            </tbody>
                        </table>
                    </div>
                }
            </div>
        );
    }
}

export default JobTable;
