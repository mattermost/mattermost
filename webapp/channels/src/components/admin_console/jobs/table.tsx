// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Job, JobType} from '@mattermost/types/jobs';

import type {ActionResult} from 'mattermost-redux/types/actions';

import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';

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
    onRowClick?: (job: Job) => void;
    perPage?: number;
    actions: {
        getJobsByType: (jobType: JobType) => void;
        cancelJob: (jobId: string) => Promise<ActionResult>;
        createJob: (job: {type: JobType}) => Promise<ActionResult>;
    };
}

type State = {
    currentPage: number;
}

class JobTable extends React.PureComponent<Props, State> {
    interval: ReturnType<typeof setInterval>|null = null;

    constructor(props: Props) {
        super(props);
        this.state = {
            currentPage: 0,
        };
    }

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

    handleNextPage = () => {
        if (this.props.perPage) {
            const totalPages = Math.ceil(this.props.jobs.length / this.props.perPage);
            if (this.state.currentPage < totalPages) {
                this.setState({currentPage: this.state.currentPage + 1});
            }
        }
    };

    handlePrevPage = () => {
        if (this.state.currentPage > 0) {
            this.setState({currentPage: this.state.currentPage - 1});
        }
    };

    render() {
        const {perPage} = this.props;
        const {currentPage} = this.state;

        let paginatedJobs = this.props.jobs;
        let startIndex = 0;
        let endIndex = this.props.jobs.length;

        if (perPage) {
            startIndex = currentPage * perPage;
            endIndex = Math.min(startIndex + perPage, this.props.jobs.length);
            paginatedJobs = this.props.jobs.slice(startIndex, endIndex);
        }

        const showFilesColumn = this.props.jobType === JobTypes.MESSAGE_EXPORT && this.props.downloadExportResults;
        const hideDetailsColumn = this.props.jobType === JobTypes.ACCESS_CONTROL_SYNC;
        const items = paginatedJobs.map((job) => {
            return (
                <tr
                    key={job.id}
                    onClick={this.props.onRowClick ? () => this.props.onRowClick!(job) : undefined}
                    className={this.props.onRowClick ? 'clickable' : ''}
                >
                    <td className='whitespace--nowrap'><JobStatus job={job}/></td>
                    <td className='whitespace--nowrap'>
                        <JobFinishAt
                            status={job.status}
                            millis={job.last_activity_at}
                        />
                    </td>
                    <td className='whitespace--nowrap'><JobRunLength job={job}/></td>
                    {showFilesColumn &&
                        <td className='whitespace--nowrap'><JobDownloadLink job={job}/></td>
                    }
                    {!hideDetailsColumn && (
                        <td>{this.getExtraInfoText(job)}</td>
                    )}
                    <td className='cancel-button-field whitespace--nowrap text-center'>
                        <JobCancelButton
                            job={job}
                            onClick={this.handleCancelJob}
                            disabled={this.props.disabled}
                        />
                    </td>
                </tr>
            );
        });

        const renderFooter = (): JSX.Element | null => {
            let footer: JSX.Element | null = null;

            if (perPage) {
                const firstPage = startIndex <= 0;
                const lastPage = endIndex >= this.props.jobs.length;

                footer = (
                    <div className='DataGrid_footer'>
                        <div className='DataGrid_cell'>
                            <FormattedMessage
                                id='admin.data_grid.paginatorCount'
                                defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                                values={{
                                    startCount: startIndex + 1,
                                    endCount: endIndex,
                                    total: this.props.jobs.length,
                                }}
                            />
                            <button
                                type='button'
                                className={'btn btn-quaternary btn-icon btn-sm ml-2 prev ' + (firstPage ? 'disabled' : '')}
                                onClick={this.handlePrevPage}
                                disabled={firstPage}
                                aria-label={'Previous page'}
                            >
                                <PreviousIcon/>
                            </button>
                            <button
                                type='button'
                                className={'btn btn-quaternary btn-icon btn-sm next ' + (lastPage ? 'disabled' : '')}
                                onClick={this.handleNextPage}
                                disabled={lastPage}
                                aria-label={'Next page'}
                            >
                                <NextIcon/>
                            </button>
                        </div>
                    </div>
                );
            }

            return footer;
        };

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
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerStatus'
                                            defaultMessage='Status'
                                        />
                                    </th>
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
                                    {showFilesColumn &&
                                    <th>
                                        <FormattedMessage
                                            id='admin.jobTable.headerFiles'
                                            defaultMessage='Files'
                                        />
                                    </th>
                                    }
                                    {!hideDetailsColumn && (
                                        <th colSpan={3}>
                                            <FormattedMessage
                                                id='admin.jobTable.headerExtraInfo'
                                                defaultMessage='Details'
                                            />
                                        </th>
                                    )}
                                    <th className='cancel-button-field'/>
                                </tr>
                            </thead>
                            <tbody>
                                {items}
                            </tbody>
                        </table>
                        {perPage && this.props.jobs.length > 0 && (
                            renderFooter()
                        )}
                    </div>
                }
            </div>
        );
    }
}

export default JobTable;
