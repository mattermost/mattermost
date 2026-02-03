// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ReportDuration} from '@mattermost/types/reports';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {startUsersBatchExport} from 'actions/views/admin';
import {openModal} from 'actions/views/modals';
import {getAdminConsoleUserManagementTableProperties} from 'selectors/views/admin';

import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';
import {isMinimumProfessionalLicense} from 'utils/license_utils';

import {ExportErrorModal} from './export_error_modal';
import {ExportUserDataModal} from './export_user_data_modal';
import {UpgradeExportDataModal} from './upgrade_export_data_modal';

import {convertTableOptionsToUserReportOptions} from '../utils';

import './system_users_export.scss';

interface Props {
    currentUserId: UserProfile['id'];
    usersLenght: number;
}

export function SystemUsersExport(props: Props) {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const skipDialog = useSelector((state: GlobalState) => get(state, Preferences.CATEGORY_REPORTING, Preferences.HIDE_BATCH_EXPORT_CONFIRM_MODAL, '')) === 'true';
    const tableFilterProps = useSelector(getAdminConsoleUserManagementTableProperties);
    const tableOptionsToUserReport = convertTableOptionsToUserReportOptions(tableFilterProps);
    if (tableOptionsToUserReport.date_range === undefined) {
        tableOptionsToUserReport.date_range = ReportDuration.AllTime;
    }

    const license = useSelector(getLicense);
    const isLicensed = license.IsLicensed === 'true' && isMinimumProfessionalLicense(license);

    async function doExport(checked?: boolean) {
        const {error} = await dispatch(startUsersBatchExport(tableOptionsToUserReport));
        if (error) {
            dispatch(openModal({
                modalId: ModalIdentifiers.EXPORT_ERROR_MODAL,
                dialogType: ExportErrorModal,
                dialogProps: {error},
            }));
            return;
        }

        if (checked) {
            dispatch(savePreferences(props.currentUserId, [{
                category: Preferences.CATEGORY_REPORTING,
                name: Preferences.HIDE_BATCH_EXPORT_CONFIRM_MODAL,
                user_id: props.currentUserId,
                value: 'true',
            }]));
        }
    }

    function handleExport() {
        if (!props.usersLenght) {
            return;
        }
        if (!isLicensed) {
            dispatch(openModal({
                modalId: ModalIdentifiers.UPGRADE_EXPORT_DATA_MODAL,
                dialogType: UpgradeExportDataModal,
                dialogProps: {},
            }));
            return;
        }

        if (skipDialog) {
            doExport();
            return;
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.EXPORT_USER_DATA_MODAL,
            dialogType: ExportUserDataModal,
            dialogProps: {onConfirm: doExport},
        }));
    }

    const button = (
        <button
            onClick={handleExport}
            className='btn btn-md btn-tertiary'
            disabled={!props.usersLenght}
        >
            <span className='icon icon-download-outline'/>
            <FormattedMessage
                id='admin.system_users.exportButton'
                defaultMessage='Export'
            />
        </button>
    );

    if (!isLicensed) {
        return (
            <>
                <WithTooltip
                    title={formatMessage({id: 'admin.system_users.exportButton.notLicensed.title', defaultMessage: 'Professional feature'})}
                    hint={formatMessage({id: 'admin.system_users.exportButton.notLicensed.hint', defaultMessage: 'This feature is available on the professional plan'})}
                >
                    {button}
                </WithTooltip>
                <div className='system-users-export__keyIndicator'>
                    <i className='icon icon-key-variant'/>
                </div>
            </>
        );
    }

    return button;
}
