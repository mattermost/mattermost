// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ServerError} from '@mattermost/types/errors';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    error: ServerError;
    onExited: () => void;
}

export function ExportErrorModal({error, onExited}: Props) {
    const isInProgress = error.status_code === 400 &&
        error.server_error_id === 'app.report.start_users_batch_export.job_exists';

    let title = (
        <FormattedMessage
            id='export_error_modal.title'
            defaultMessage='Export could not be initiated'
        />
    );

    let message = (
        <>
            <FormattedMessage
                id='export_error_modal.desc'
                defaultMessage='We’re not able to initiate an export of this data at the moment. Please wait a few minutes and try again.'
            />
            <div className='error'>{error.message}</div>
        </>
    );

    if (isInProgress) {
        title = (
            <FormattedMessage
                id='export_error_modal.inProgress.title'
                defaultMessage='Export is in progress'
            />
        );
        message = (
            <FormattedMessage
                id='export_error_modal.inProgress.desc'
                defaultMessage={'You\'ve already started an export of this data. Please wait a few more minutes to access the CSV file or to generate the report again.'}
            />
        );
    }

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonText={
                <FormattedMessage
                    id='generic.okay'
                    defaultMessage='Okay'
                />
            }
            onExited={onExited}
        />
    );
}
