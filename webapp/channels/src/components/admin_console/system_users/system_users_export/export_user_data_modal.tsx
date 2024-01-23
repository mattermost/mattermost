// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {ReportDuration} from '@mattermost/types/reports';

import {getAdminConsoleUserManagementTableProperties} from 'selectors/views/admin';

import ConfirmModalRedux from 'components/confirm_modal_redux';

import {t} from 'utils/i18n';

type Props = {
    onConfirm: (checked: boolean) => void;
    onExited: () => void;
}

export function ExportUserDataModal({onConfirm, onExited}: Props) {
    const dateRange = useSelector(getAdminConsoleUserManagementTableProperties).dateRange ?? ReportDuration.AllTime;

    const title = (
        <FormattedMessage
            id='export_user_data_modal.title'
            defaultMessage='Export user data'
        />
    );

    const message = (
        <>
            <FormattedMessage
                id='export_user_data_modal.desc'
                defaultMessage={'You\'re about to export user data for {dateRange}. When the export is ready, a CSV file will be sent to you in a Mattermost direct message. This export will take a few minutes.'}
                values={{
                    dateRange: (
                        <b>
                            <FormattedMessage
                                id={`export_user_data_modal.date_range.${dateRange}`}
                                defaultMessage='all time'
                            />
                        </b>
                    ),
                }}
            />
        </>
    );

    const exportDataButton = (
        <FormattedMessage
            id='export_user_data_modal.export_data'
            defaultMessage='Export data'
        />
    );

    const checkboxText = (
        <FormattedMessage
            id='export_user_data_modal.do_not_show'
            defaultMessage='Do not show this again'
        />
    );

    return (
        <ConfirmModalRedux
            title={title}
            message={message}
            confirmButtonText={exportDataButton}
            showCheckbox={true}
            checkboxText={checkboxText}
            checkboxInFooter={true}
            onConfirm={onConfirm}
            onExited={onExited}
        />
    );
}

t('export_user_data_modal.date_range.all_time');
t('export_user_data_modal.date_range.last_30_days');
t('export_user_data_modal.date_range.previous_month');
t('export_user_data_modal.date_range.last_6_months');
