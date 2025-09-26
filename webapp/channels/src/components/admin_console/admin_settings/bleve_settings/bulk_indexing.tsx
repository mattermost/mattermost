// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Job} from '@mattermost/types/jobs';

import JobsTable from 'components/admin_console/jobs';
import SettingSet from 'components/admin_console/setting_set';

import {JobStatuses, JobTypes} from 'utils/constants';

import {messages} from './messages';

const createJobButtonText = (
    <FormattedMessage
        id='admin.bleve.createJob.title'
        defaultMessage='Index Now'
    />
);
const createJobHelpText = (<FormattedMessage {...messages.createJob_help}/>);

type Props = {
    canPurgeAndIndex: boolean;
    isDisabled?: boolean;
}
const BulkIndexing = ({
    canPurgeAndIndex,
    isDisabled = false,
}: Props) => {
    const getExtraInfo = useCallback((job: Job) => {
        if (job.status === JobStatuses.IN_PROGRESS) {
            return (
                <FormattedMessage
                    id='admin.bleve.percentComplete'
                    defaultMessage='{percent}% Complete'
                    values={{percent: Number(job.progress)}}
                />
            );
        }

        return <></>;
    }, []);

    return (
        <SettingSet
            label={<FormattedMessage {...messages.bulkIndexingTitle}/>}
        >
            <div className='job-table-setting'>
                <JobsTable
                    jobType={JobTypes.BLEVE_POST_INDEXING}
                    disabled={!canPurgeAndIndex || isDisabled}
                    createJobButtonText={createJobButtonText}
                    createJobHelpText={createJobHelpText}
                    getExtraInfoText={getExtraInfo}
                />
            </div>
        </SettingSet>
    );
};

export default BulkIndexing;
