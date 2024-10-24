// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import SettingsGroup from 'components/admin_console/settings_group';

import {exportFormats} from 'utils/constants';

import {FIELD_IDS} from './constants';
import EnableComplianceExport from './enable_compliance_export';
import ExportFormat from './export_format';
import ExportJobStartTime from './export_job_start_time';
import GlobalRelayCustomSMTPPort from './global_relay_custom_smtp_port';
import GlobalRelayCustomSMTPServerName from './global_relay_custom_smtp_server_name';
import GlobalRelayCustomerType from './global_relay_customer_type';
import GlobalRelayEmailAddress from './global_relay_email';
import GlobalRelaySMTPPassword from './global_relay_password';
import GlobalRelaySMTPUsername from './global_relay_smtp_username';
import RunComplianceExport from './run_compliance_export';

import AdminSetting from '../admin_settings';
import {useAdminSettingState} from '../hooks';
import type {GetConfigFromStateFunction, GetStateFromConfigFunction} from '../types';

export {searchableStrings} from './messages';

const getConfigFromState: GetConfigFromStateFunction = (state) => {
    const config: DeepPartial<AdminConfig> = {
        MessageExportSettings: {
            EnableExport: state[FIELD_IDS.ENABLE_COMPLIANCE_EXPORT],
            ExportFormat: state[FIELD_IDS.EXPORT_FORMAT],
            DailyRunTime: state[FIELD_IDS.EXPORT_JOB_START_TIME],
        },
    };

    if (state[FIELD_IDS.EXPORT_FORMAT] === exportFormats.EXPORT_FORMAT_GLOBALRELAY) {
        config.MessageExportSettings!.GlobalRelaySettings = {
            CustomerType: state[FIELD_IDS.GLOBAL_RELAY_CUSTOMER_TYPE],
            SMTPUsername: state[FIELD_IDS.GLOBAL_RELAY_SMTP_USERNAME],
            SMTPPassword: state[FIELD_IDS.GLOBAL_RELAY_SMTP_PASSWORD],
            EmailAddress: state[FIELD_IDS.GLOBAL_RELAY_EMAIL_ADDRESS],
            CustomSMTPServerName: state[FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_SERVER_NAME],
            CustomSMTPPort: state[FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_PORT],
            SMTPServerTimeout: state[FIELD_IDS.GLOBAL_RELAY_SMTP_SERVER_TIMEOUT],
        };
    }
    return config;
};

const getStateFromConfig: GetStateFromConfigFunction = (config) => {
    const state = {
        enableComplianceExport: config.MessageExportSettings.EnableExport,
        exportFormat: config.MessageExportSettings.ExportFormat,
        exportJobStartTime: config.MessageExportSettings.DailyRunTime,
        globalRelayCustomerType: '',
        globalRelaySMTPUsername: '',
        globalRelaySMTPPassword: '',
        globalRelayEmailAddress: '',
        globalRelaySMTPServerTimeout: 0,
        globalRelayCustomSMTPServerName: '',
        globalRelayCustomSMTPPort: '',
        saveNeeded: false,
        saving: false,
        serverError: null,
    };
    if (config.MessageExportSettings.GlobalRelaySettings) {
        state.globalRelayCustomerType = config.MessageExportSettings.GlobalRelaySettings.CustomerType;
        state.globalRelaySMTPUsername = config.MessageExportSettings.GlobalRelaySettings.SMTPUsername;
        state.globalRelaySMTPPassword = config.MessageExportSettings.GlobalRelaySettings.SMTPPassword;
        state.globalRelayEmailAddress = config.MessageExportSettings.GlobalRelaySettings.EmailAddress;
        state.globalRelayCustomSMTPServerName = config.MessageExportSettings.GlobalRelaySettings.CustomSMTPServerName;
        state.globalRelayCustomSMTPPort = config.MessageExportSettings.GlobalRelaySettings.CustomSMTPPort;
    }
    return state;
};

function renderTitle() {
    return (
        <FormattedMessage
            id='admin.complianceExport.title'
            defaultMessage='Compliance Export'
        />
    );
}

type Props = {
    isDisabled?: boolean;
}

const MessageExportSettings = ({
    isDisabled,
}: Props) => {
    const {
        doSubmit,
        handleChange,
        saveNeeded,
        saving,
        serverError,
        settingValues,
    } = useAdminSettingState(getConfigFromState, getStateFromConfig);

    const generalDisable = isDisabled || !settingValues[FIELD_IDS.ENABLE_COMPLIANCE_EXPORT];

    const renderGlobalRelaySettings = useCallback(() => {
        if (settingValues[FIELD_IDS.EXPORT_FORMAT] !== exportFormats.EXPORT_FORMAT_GLOBALRELAY) {
            return null;
        }

        return (
            <SettingsGroup id={'globalRelaySettings'} >
                <GlobalRelayCustomerType
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.GLOBAL_RELAY_CUSTOMER_TYPE] || ''}
                    isDisabled={generalDisable}
                />
                <GlobalRelaySMTPUsername
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.GLOBAL_RELAY_SMTP_USERNAME] || ''}
                    isDisabled={generalDisable}
                />
                <GlobalRelaySMTPPassword
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.GLOBAL_RELAY_SMTP_PASSWORD] || ''}
                    isDisabled={generalDisable}
                />
                <GlobalRelayEmailAddress
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.GLOBAL_RELAY_EMAIL_ADDRESS] || ''}
                    isDisabled={generalDisable}
                />
                {settingValues[FIELD_IDS.GLOBAL_RELAY_CUSTOMER_TYPE] === 'CUSTOM' && (
                    <GlobalRelayCustomSMTPServerName
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_SERVER_NAME] || ''}
                        isDisabled={generalDisable}
                    />
                )}
                {settingValues[FIELD_IDS.GLOBAL_RELAY_CUSTOMER_TYPE] === 'CUSTOM' && (
                    <GlobalRelayCustomSMTPPort
                        onChange={handleChange}
                        value={settingValues[FIELD_IDS.GLOBAL_RELAY_CUSTOM_SMTP_PORT] || ''}
                        isDisabled={generalDisable}
                    />
                )}
            </SettingsGroup>
        );
    }, [generalDisable, handleChange, settingValues]);

    const renderSettings = useCallback(() => {
        return (
            <SettingsGroup>
                <EnableComplianceExport
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.ENABLE_COMPLIANCE_EXPORT]}
                    isDisabled={isDisabled}
                />
                <ExportJobStartTime
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.EXPORT_JOB_START_TIME]}
                    isDisabled={generalDisable}
                />
                <ExportFormat
                    onChange={handleChange}
                    value={settingValues[FIELD_IDS.EXPORT_FORMAT]}
                    isDisabled={generalDisable}
                />
                {renderGlobalRelaySettings()}
                <RunComplianceExport isDisabled={generalDisable}/>
            </SettingsGroup>
        );
    }, [generalDisable, handleChange, isDisabled, renderGlobalRelaySettings, settingValues]);

    return (
        <AdminSetting
            doSubmit={doSubmit}
            renderSettings={renderSettings}
            renderTitle={renderTitle}
            saveNeeded={saveNeeded}
            saving={saving}
            serverError={serverError}
            isDisabled={isDisabled}
        />
    );
};

export default MessageExportSettings;
