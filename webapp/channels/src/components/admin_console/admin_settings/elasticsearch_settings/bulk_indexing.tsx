// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Job, JobType} from '@mattermost/types/jobs';

import JobsTable from 'components/admin_console/jobs';

import {JobStatuses, JobTypes} from 'utils/constants';

import {messages} from './messages';

type Props = {
    isDisabled?: boolean;
}

const BulkIndexing = ({
    isDisabled = false,
}: Props) => {
    const getExtraInfo = useCallback((job: Job) => {
        let jobSubType = null;
        if (job.data?.sub_type === 'channels_index_rebuild') {
            jobSubType = (
                <span>
                    {'. '}
                    <FormattedMessage
                        id='admin.elasticsearch.channelIndexRebuildJobTitle'
                        defaultMessage='Channels index rebuild job.'
                    />
                </span>
            );
        }

        let jobProgress = null;
        if (job.status === JobStatuses.IN_PROGRESS) {
            jobProgress = (
                <FormattedMessage
                    id='admin.elasticsearch.percentComplete'
                    defaultMessage='{percent}% Complete'
                    values={{percent: Number(job.progress)}}
                />
            );
        }

        return (<span>{jobProgress}{jobSubType}</span>);
    }, []);

    return (
        <div className='form-group'>
            <label className='control-label col-sm-4'>
                <FormattedMessage {...messages.bulkIndexingTitle}/>
            </label>
            <div className='col-sm-8'>
                <div className='job-table-setting'>
                    <JobsTable
                        jobType={JobTypes.ELASTICSEARCH_POST_INDEXING as JobType}
                        disabled={isDisabled}
                        createJobButtonText={
                            <FormattedMessage
                                id='admin.elasticsearch.createJob.title'
                                defaultMessage='Index Now'
                            />
                        }
                        createJobHelpText={<FormattedMessage {...messages.help}/>}
                        getExtraInfoText={getExtraInfo}
                    />
                </div>
            </div>
        </div>
    );
};

export default BulkIndexing;
