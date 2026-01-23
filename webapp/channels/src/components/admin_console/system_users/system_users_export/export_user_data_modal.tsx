// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {ReportDuration} from '@mattermost/types/reports';

import {getAdminConsoleUserManagementTableProperties} from 'selectors/views/admin';

import ConfirmModalRedux from 'components/confirm_modal_redux';

type Props = {
    onConfirm: (checked: boolean) => void;
    onExited: () => void;
}

export function ExportUserDataModal({onConfirm, onExited}: Props) {
    const tableFilterProps = useSelector(getAdminConsoleUserManagementTableProperties);
    const dateRange = tableFilterProps.dateRange ?? ReportDuration.AllTime;

    const title = (
        <FormattedMessage
            id='export_user_data_modal.title'
            defaultMessage='Export user data'
        />
    );

    let message = (
        <FormattedMessage
            id='export_user_data_modal.dange_range.all_time'
            defaultMessage={'You\'re about to export user data for all time. When the export is ready, a CSV file will be sent to you in a Mattermost direct message. This export will take a few minutes.'}
        />
    );
    if (dateRange === ReportDuration.Last30Days) {
        message = (
            <FormattedMessage
                id='export_user_data_modal.dange_range.last_30_days'
                defaultMessage={'You\'re about to export user data for the last 30 days. When the export is ready, a CSV file will be sent to you in a Mattermost direct message. This export will take a few minutes.'}
            />
        );
    } else if (dateRange === ReportDuration.PreviousMonth) {
        message = (
            <FormattedMessage
                id='export_user_data_modal.dange_range.previous_month'
                defaultMessage={'You\'re about to export user data for the previous month. When the export is ready, a CSV file will be sent to you in a Mattermost direct message. This export will take a few minutes.'}
            />
        );
    } else if (dateRange === ReportDuration.Last6Months) {
        message = (
            <FormattedMessage
                id='export_user_data_modal.dange_range.last_6_months'
                defaultMessage={'You\'re about to export user data for the last 6 months. When the export is ready, a CSV file will be sent to you in a Mattermost direct message. This export will take a few minutes.'}
            />
        );
    }

    const tableFiltersAreSet = tableFilterProps.filterRole !== '' || tableFilterProps.filterStatus || tableFilterProps.filterTeam !== '';
    if (tableFiltersAreSet) {
        message = (
            <>
                {message}
                <p className='mt-3 text-muted'>
                    <FormattedMessage
                        id='export_user_data_modal.export_data.table_filters_note'
                        defaultMessage={'Note: The exported data will use the filters you have set in the users list. To export all data first remove the filters.'}
                    />
                </p>
            </>
        );
    }

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
            id='exportUserDataModal'
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
