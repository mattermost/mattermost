// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Job} from '@mattermost/types/jobs';

import JobsTable from 'components/admin_console/jobs';

import {JobTypes, exportFormats} from 'utils/constants';

import {messages} from './messages';

const getJobDetails = (job: Job) => {
    if (job.data) {
        const message = [];
        if (job.data.messages_exported) {
            message.push(
                <FormattedMessage
                    id='admin.complianceExport.messagesExportedCount'
                    defaultMessage='{count} messages exported.'
                    values={{
                        count: job.data.messages_exported,
                    }}
                />,
            );
        }
        if (job.data.warning_count > 0) {
            if (job.data.export_type === exportFormats.EXPORT_FORMAT_GLOBALRELAY) {
                message.push(
                    <div>
                        <FormattedMessage
                            id='admin.complianceExport.warningCount.globalrelay'
                            defaultMessage='{count} warning(s) encountered, see log for details'
                            values={{
                                count: job.data.warning_count,
                            }}
                        />
                    </div>,
                );
            } else {
                message.push(
                    <div>
                        <FormattedMessage
                            id='admin.complianceExport.warningCount'
                            defaultMessage='{count} warning(s) encountered, see warning.txt for details'
                            values={{
                                count: job.data.warning_count,
                            }}
                        />
                    </div>,
                );
            }
        }
        return message;
    }
    return null;
};
const createJobButtonText = <FormattedMessage {...messages.createJob_title}/>;
const createJobHelpText = <FormattedMessage {...messages.createJob_help}/>;

type Props = {
    isDisabled?: boolean;
}

const RunComplianceExport = ({
    isDisabled = false,
}: Props) => {
    return (
        <JobsTable
            jobType={JobTypes.MESSAGE_EXPORT}
            createJobButtonText={createJobButtonText}
            createJobHelpText={createJobHelpText}
            getExtraInfoText={getJobDetails}
            disabled={isDisabled}
        />
    );
};

export default RunComplianceExport;
