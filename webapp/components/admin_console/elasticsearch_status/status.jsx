// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

import {createJob, cancelJob} from 'actions/job_actions.jsx';
import {JobTypes, JobStatuses} from 'utils/constants.jsx';
import RequestButton from '../request_button/request_button.jsx';

export default class Status extends React.PureComponent {
    static propTypes = {

        /**
         * Array of jobs
         */
        jobs: PropTypes.arrayOf(PropTypes.object).isRequired,

        /**
         * Whether Elasticsearch is properly configured.
         */
        isConfigured: PropTypes.bool.isRequired,

        actions: PropTypes.shape({

            /**
             * Function to fetch jobs
             */
            getJobsByType: PropTypes.func.isRequired
        }).isRequired
    };

    constructor(props) {
        super(props);

        this.interval = null;

        this.state = {
            loading: true,
            cancelInProgress: false
        };
    }

    componentWillMount() {
        // reload the cluster status every 15 seconds
        this.interval = setInterval(this.reload, 15000);
    }

    componentDidMount() {
        this.props.actions.getJobsByType(JobTypes.ELASTICSEARCH_POST_INDEXING).then(
            () => this.setState({loading: false})
        );
    }

    componentWillUnmount() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    reload = () => {
        this.props.actions.getJobsByType(JobTypes.ELASTICSEARCH_POST_INDEXING).then(
            () => {
                this.setState({
                    loading: false,
                    cancelInProgress: false
                });
            }
        );
    };

    createIndexJob = (success, error) => {
        const job = {
            type: JobTypes.ELASTICSEARCH_POST_INDEXING
        };

        createJob(
            job,
            () => {
                this.reload();
                success();
            },
            error
        );
    };

    cancelIndexJob = (e) => {
        e.preventDefault();

        const chosenJob = this.getChosenJob();
        if (!chosenJob) {
            return;
        }

        this.setState({
            cancelInProgress: true
        });

        cancelJob(
            chosenJob.id,
            () => {
                this.reload();
            },
            () => {
                this.reload();
            }
        );
    };

    getChosenJob = () => {
        let chosenJob = null;

        if (this.props.jobs.length > 0) {
            for (let i = 0; i < this.props.jobs.length; i++) {
                const job = this.props.jobs[i];
                if (job.status === JobStatuses.CANCEL_REQUESTED || job.status === JobStatuses.IN_PROGRESS) {
                    chosenJob = job;
                } else {
                    break;
                }
            }

            if (!chosenJob) {
                for (let i = 0; i < this.props.jobs.length; i++) {
                    const job = this.props.jobs[i];
                    if (job.status !== JobStatuses.PENDING && chosenJob) {
                        continue;
                    } else {
                        chosenJob = job;
                        break;
                    }
                }
            }
        }

        return chosenJob;
    };

    render() {
        const chosenJob = this.getChosenJob();

        let indexButtonDisabled = !this.props.isConfigured;
        let buttonText = (
            <FormattedMessage
                id='admin.elasticsearch.indexButton.ready'
                defaultMessage='Build Index'
            />
        );
        let cancelButton = null;
        let indexButtonHelp = (
            <FormattedMessage
                id='admin.elasticsearch.indexHelpText.buildIndex'
                defaultMessage='All posts in the database will be indexed from oldest to newest. Elasticsearch is available during indexing but search results may be incomplete until the indexing job is complete.'
            />
        );

        if (this.state.loading) {
            indexButtonDisabled = true;
        } else if (chosenJob) {
            if (chosenJob.status === JobStatuses.PENDING || chosenJob.status === JobStatuses.IN_PROGRESS || chosenJob.status === JobStatuses.CANCEL_REQUESTED) {
                indexButtonDisabled = true;
                buttonText = (
                    <span>
                        <span className='fa fa-refresh icon--rotate'/>
                        <FormattedMessage
                            id='admin.elasticsearch.indexButton.inProgress'
                            defaultMessage='Indexing in progress'
                        />
                    </span>
                );
            }

            if (chosenJob.status === JobStatuses.PENDING || chosenJob.status === JobStatuses.IN_PROGRESS || chosenJob.status === JobStatuses.CANCEL_REQUESTED) {
                indexButtonHelp = (
                    <FormattedMessage
                        id='admin.elasticsearch.indexHelpText.cancelIndexing'
                        defaultMessage='Cancelling stops the indexing job and removes it from the queue. Posts that have already been indexed will not be deleted.'
                    />
                );
            }

            if (!this.state.cancelInProgress && (chosenJob.status === JobStatuses.PENDING || chosenJob.status === JobStatuses.IN_PROGRESS)) {
                cancelButton = (
                    <a
                        href='#'
                        className='btn btn-link'
                        onClick={this.cancelIndexJob}
                    >
                        <FormattedMessage
                            id='admin.elasticsearchStatus.cancelButton'
                            defaultMessage='Cancel'
                        />
                    </a>
                );
            }
        }

        const indexButton = (
            <RequestButton
                requestAction={this.createIndexJob}
                helpText={indexButtonHelp}
                buttonText={buttonText}
                disabled={indexButtonDisabled}
                showSuccessMessage={false}
                errorMessage={{
                    id: 'admin.elasticsearch.bulkIndexButton.error',
                    defaultMessage: 'Failed to schedule Bulk Index Job: {error}'
                }}
                alternativeActionElement={cancelButton}
                label={(
                    <FormattedMessage
                        id='admin.elasticsearchStatus.bulkIndexLabel'
                        defaultMessage='Bulk Indexing:'
                    />
                )}
            />
        );

        let status = null;
        let statusHelp = null;
        let statusClass = null;
        if (!this.props.isConfigured) {
            status = (
                <FormattedMessage
                    id='admin.elasticsearchStatus.statusIndexingDisabled'
                    defaultMessage='Indexing disabled.'
                />
            );
        } else if (this.state.loading) {
            status = (
                <FormattedMessage
                    id='admin.elasticsearchStatus.statusLoading'
                    defaultMessage='Loading...'
                />
            );
            statusClass = 'status-icon-unknown';
        } else if (chosenJob) {
            if (chosenJob.status === JobStatuses.PENDING) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusPending'
                        defaultMessage='Job pending.'
                    />
                );
                statusHelp = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusPending.help'
                        defaultMessage='Elasticsearch index job is queued on the job server. If Elasticsearch is enabled, search results may be incomplete until the job is finished.'
                    />
                );
                statusClass = 'status-icon-warning';
            } else if (chosenJob.status === JobStatuses.IN_PROGRESS) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusInProgress'
                        defaultMessage='Job in progress. {percent}% complete.'
                        values={{
                            percent: chosenJob.progress
                        }}
                    />
                );
                statusHelp = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusInProgress.help'
                        defaultMessage='Indexing is in progress on the job server. If Elasticsearch is enabled, search results may be incomplete until the job is finished.'
                    />
                );
                statusClass = 'status-icon-warning';
            } else if (chosenJob.status === JobStatuses.SUCCESS) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusSuccess'
                        defaultMessage='Indexing complete.'
                    />
                );
                statusHelp = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusSuccess.help'
                        defaultMessage='Indexing is complete and new posts are being automatically indexed.'
                    />
                );
                statusClass = 'status-icon-success';
            } else if (chosenJob.status === JobStatuses.ERROR) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusError'
                        defaultMessage='Indexing error.'
                    />
                );
                statusHelp = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusError.help'
                        defaultMessage='Mattermost encountered an error building the Elasticsearch index: {error}'
                        values={{
                            error: chosenJob.data ? (chosenJob.data.error || '') : ''
                        }}
                    />
                );
                statusClass = 'status-icon-error';
            } else if (chosenJob.status === JobStatuses.CANCEL_REQUESTED) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusRequestCancel'
                        defaultMessage='Canceling Job...'
                    />
                );
                statusClass = 'status-icon-warning';
            } else if (chosenJob.status === JobStatuses.CANCELED) {
                status = (
                    <FormattedMessage
                        id='admin.elasticsearchStatus.statusCancelled'
                        defaultMessage='Indexing job cancelled.'
                    />
                );
                statusClass = 'status-icon-error';
            }
        } else {
            status = (
                <FormattedMessage
                    id='admin.elasticsearchStatus.statusNoJobs'
                    defaultMessage='No indexing jobs queued.'
                />
            );
            statusClass = 'status-icon-unknown';
        }

        if (statusHelp !== null) {
            statusHelp = (
                <div className='col-sm-offset-4 col-sm-8'>
                    <div className='help-text'>
                        {statusHelp}
                    </div>
                </div>
            );
        }

        statusClass = 'fa fa-circle margin--right ' + statusClass;

        return (
            <div>
                {indexButton}
                <div className='form-group'>
                    <div className='col-sm-offset-4 col-sm-8'>
                        <div className='help-text no-margin'>
                            <FormattedMessage
                                id='admin.elasticsearchStatus.status'
                                defaultMessage='Status: '
                            />
                            <i
                                className={statusClass}
                            />
                            {status}
                        </div>
                    </div>
                    {statusHelp}
                </div>
            </div>
        );
    }
}
