// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import type {MessageDescriptor, WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages, injectIntl} from 'react-intl';

import type {AdminConfig} from '@mattermost/types/config';
import type {Job} from '@mattermost/types/jobs';

import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {DocLinks, JobTypes, exportFormats} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import type {BaseProps, BaseState} from './admin_settings';
import AdminSettings from './admin_settings';
import BooleanSetting from './boolean_setting';
import DropdownSetting from './dropdown_setting';
import JobsTable from './jobs';
import RadioSetting from './radio_setting';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

interface State extends BaseState {
    enableComplianceExport: AdminConfig['MessageExportSettings']['EnableExport'];
    exportFormat: AdminConfig['MessageExportSettings']['ExportFormat'];
    exportJobStartTime: AdminConfig['MessageExportSettings']['DailyRunTime'];
    globalRelayCustomerType: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['CustomerType'];
    globalRelaySMTPUsername: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['SMTPUsername'];
    globalRelaySMTPPassword: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['SMTPPassword'];
    globalRelayEmailAddress: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['EmailAddress'];
    globalRelayCustomSMTPServerName: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['CustomSMTPServerName'];
    globalRelayCustomSMTPPort: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['CustomSMTPPort'];
    globalRelaySMTPServerTimeout: AdminConfig['MessageExportSettings']['GlobalRelaySettings']['SMTPServerTimeout'];
}

const messages = defineMessages({
    globalRelayCustomerType_title: {id: 'admin.complianceExport.globalRelayCustomerType.title', defaultMessage: 'Customer Type:'},
    globalRelayCustomerType_description: {id: 'admin.complianceExport.globalRelayCustomerType.description', defaultMessage: 'The type of GlobalRelay customer account that your organization has.'},
    globalRelaySMTPUsername_title: {id: 'admin.complianceExport.globalRelaySMTPUsername.title', defaultMessage: 'SMTP Username:'},
    globalRelaySMTPUsername_description: {id: 'admin.complianceExport.globalRelaySMTPUsername.description', defaultMessage: 'The username that is used to authenticate against the GlobalRelay SMTP server.'},
    globalRelaySMTPPassword_title: {id: 'admin.complianceExport.globalRelaySMTPPassword.title', defaultMessage: 'SMTP Password:'},
    globalRelaySMTPPassword_description: {id: 'admin.complianceExport.globalRelaySMTPPassword.description', defaultMessage: 'The password that is used to authenticate against the GlobalRelay SMTP server.'},
    globalRelayEmailAddress_title: {id: 'admin.complianceExport.globalRelayEmailAddress.title', defaultMessage: 'Email Address:'},
    globalRelayEmailAddress_description: {id: 'admin.complianceExport.globalRelayEmailAddress.description', defaultMessage: 'The email address that your GlobalRelay server monitors for incoming Compliance Exports.'},
    complianceExportTitle: {id: 'admin.service.complianceExportTitle', defaultMessage: 'Enable Compliance Export:'},
    complianceExportDesc: {id: 'admin.service.complianceExportDesc', defaultMessage: 'When true, Mattermost will export all messages that were posted in the last 24 hours. The export task is scheduled to run once per day. See <link>the documentation</link> to learn more.'},
    exportJobStartTime_title: {id: 'admin.complianceExport.exportJobStartTime.title', defaultMessage: 'Compliance Export Time:'},
    exportJobStartTime_description: {id: 'admin.complianceExport.exportJobStartTime.description', defaultMessage: 'Set the start time of the daily scheduled compliance export job. Choose a time when fewer people are using your system. Must be a 24-hour time stamp in the form HH:MM.'},
    exportFormat_title: {id: 'admin.complianceExport.exportFormat.title', defaultMessage: 'Export Format:'},
    exportFormat_description: {id: 'admin.complianceExport.exportFormat.description', defaultMessage: 'Format of the compliance export. Corresponds to the system that you want to import the data into.{lineBreak} {lineBreak}For Actiance XML, compliance export files are written to the exports subdirectory of the configured [Local Storage Directory]({url}). For Global Relay EML, they are emailed to the configured email address.'},
    createJob_title: {id: 'admin.complianceExport.createJob.title', defaultMessage: 'Run Compliance Export Job Now'},
    createJob_help: {id: 'admin.complianceExport.createJob.help', defaultMessage: 'Initiates a Compliance Export job immediately.'},
});

export const searchableStrings: Array<string|MessageDescriptor|[MessageDescriptor, {[key: string]: any}]> = [
    [messages.exportFormat_description, {siteURL: ''}],
    messages.complianceExportTitle,
    messages.complianceExportDesc,
    messages.exportJobStartTime_title,
    messages.exportJobStartTime_description,
    messages.exportFormat_title,
    messages.createJob_title,
    messages.createJob_help,
    messages.globalRelayCustomerType_title,
    messages.globalRelayCustomerType_description,
    messages.globalRelaySMTPUsername_title,
    messages.globalRelaySMTPUsername_description,
    messages.globalRelaySMTPPassword_title,
    messages.globalRelaySMTPPassword_description,
    messages.globalRelayEmailAddress_title,
    messages.globalRelayEmailAddress_description,
];

export class MessageExportSettings extends AdminSettings<BaseProps & WrappedComponentProps, State> {
    getConfigFromState = (config: AdminConfig) => {
        config.MessageExportSettings.EnableExport = this.state.enableComplianceExport;
        config.MessageExportSettings.ExportFormat = this.state.exportFormat;
        config.MessageExportSettings.DailyRunTime = this.state.exportJobStartTime;

        if (this.state.exportFormat === exportFormats.EXPORT_FORMAT_GLOBALRELAY) {
            config.MessageExportSettings.GlobalRelaySettings = {
                CustomerType: this.state.globalRelayCustomerType,
                SMTPUsername: this.state.globalRelaySMTPUsername,
                SMTPPassword: this.state.globalRelaySMTPPassword,
                EmailAddress: this.state.globalRelayEmailAddress,
                CustomSMTPServerName: this.state.globalRelayCustomSMTPServerName,
                CustomSMTPPort: this.state.globalRelayCustomSMTPPort,
                SMTPServerTimeout: this.state.globalRelaySMTPServerTimeout,
            };
        }
        return config;
    };

    getStateFromConfig(config: AdminConfig) {
        const state: State = {
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
            errorTooltip: false,
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
    }

    getJobDetails = (job: Job) => {
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

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.complianceExport.title'
                defaultMessage='Compliance Export'
            />
        );
    }

    renderSettings = () => {
        const exportFormatOptions = [
            {value: exportFormats.EXPORT_FORMAT_ACTIANCE, text: this.props.intl.formatMessage({id: 'admin.complianceExport.exportFormat.actiance', defaultMessage: 'Actiance XML'})},
            {value: exportFormats.EXPORT_FORMAT_CSV, text: this.props.intl.formatMessage({id: 'admin.complianceExport.exportFormat.csv', defaultMessage: 'CSV'})},
            {value: exportFormats.EXPORT_FORMAT_GLOBALRELAY, text: this.props.intl.formatMessage({id: 'admin.complianceExport.exportFormat.globalrelay', defaultMessage: 'GlobalRelay EML'})},
        ];

        // if the export format is globalrelay, the user needs to set some additional parameters
        let globalRelaySettings;
        if (this.state.exportFormat === exportFormats.EXPORT_FORMAT_GLOBALRELAY) {
            const globalRelayCustomerType = (
                <RadioSetting
                    id='globalRelayCustomerType'
                    values={[
                        {value: 'A9', text: this.props.intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.a9.description', defaultMessage: 'A9/Type 9'})},
                        {value: 'A10', text: this.props.intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.a10.description', defaultMessage: 'A10/Type 10'})},
                        {value: 'CUSTOM', text: this.props.intl.formatMessage({id: 'admin.complianceExport.globalRelayCustomerType.custom.description', defaultMessage: 'Custom'})},
                    ]}
                    label={<FormattedMessage {...messages.globalRelayCustomerType_title}/>}
                    helpText={<FormattedMessage {...messages.globalRelayCustomerType_description}/>}
                    value={this.state.globalRelayCustomerType ? this.state.globalRelayCustomerType : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.CustomerType')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            const globalRelaySMTPUsername = (
                <TextSetting
                    id='globalRelaySMTPUsername'
                    label={<FormattedMessage {...messages.globalRelaySMTPUsername_title}/>}
                    placeholder={defineMessage({id: 'admin.complianceExport.globalRelaySMTPUsername.example', defaultMessage: 'E.g.: "globalRelayUser"'})}
                    helpText={<FormattedMessage {...messages.globalRelaySMTPUsername_description}/>}
                    value={this.state.globalRelaySMTPUsername ? this.state.globalRelaySMTPUsername : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.SMTPUsername')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            const globalRelaySMTPPassword = (
                <TextSetting
                    id='globalRelaySMTPPassword'
                    label={<FormattedMessage {...messages.globalRelaySMTPPassword_title}/>}
                    placeholder={defineMessage({id: 'admin.complianceExport.globalRelaySMTPPassword.example', defaultMessage: 'E.g.: "globalRelayPassword"'})}
                    helpText={<FormattedMessage {...messages.globalRelaySMTPPassword_description}/>}
                    value={this.state.globalRelaySMTPPassword ? this.state.globalRelaySMTPPassword : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.SMTPPassword')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            const globalRelayEmail = (
                <TextSetting
                    id='globalRelayEmailAddress'
                    label={<FormattedMessage {...messages.globalRelayEmailAddress_title}/>}
                    placeholder={defineMessage({id: 'admin.complianceExport.globalRelayEmailAddress.example', defaultMessage: 'E.g.: "globalrelay@mattermost.com"'})}
                    helpText={<FormattedMessage {...messages.globalRelayEmailAddress_description}/>}
                    value={this.state.globalRelayEmailAddress ? this.state.globalRelayEmailAddress : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.EmailAddress')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            const globalRelaySMTPServerName = (
                <TextSetting
                    id='globalRelayCustomSMTPServerName'
                    label={
                        <FormattedMessage
                            id='admin.complianceExport.globalRelayCustomSMTPServerName.title'
                            defaultMessage='SMTP Server Name:'
                        />
                    }
                    placeholder={defineMessage({id: 'admin.complianceExport.globalRelayCustomSMTPServerName.example', defaultMessage: 'E.g.: "feeds.globalrelay.com"'})}
                    helpText={
                        <FormattedMessage
                            id='admin.complianceExport.globalRelayCustomSMTPServerName.description'
                            defaultMessage='The SMTP server name that will receive your Global Relay EML.'
                        />
                    }
                    value={this.state.globalRelayCustomSMTPServerName ? this.state.globalRelayCustomSMTPServerName : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.CustomSMTPServerName')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            const globalRelaySMTPPort = (
                <TextSetting
                    id='globalRelayCustomSMTPPort'
                    label={
                        <FormattedMessage
                            id='admin.complianceExport.globalRelayCustomSMTPPort.title'
                            defaultMessage='SMTP Server Port:'
                        />
                    }
                    placeholder={defineMessage({id: 'admin.complianceExport.globalRelayCustomSMTPPort.example', defaultMessage: 'E.g.: "25"'})}
                    helpText={
                        <FormattedMessage
                            id='admin.complianceExport.globalRelayCustomSMTPPort.description'
                            defaultMessage='The SMTP server port that will receive your Global Relay EML.'
                        />
                    }
                    value={this.state.globalRelayCustomSMTPPort ? this.state.globalRelayCustomSMTPPort : ''}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.GlobalRelaySettings.CustomSMTPPort')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            );

            globalRelaySettings = (
                <SettingsGroup id={'globalRelaySettings'} >
                    {globalRelayCustomerType}
                    {globalRelaySMTPUsername}
                    {globalRelaySMTPPassword}
                    {globalRelayEmail}
                    {
                        this.state.globalRelayCustomerType === 'CUSTOM' &&
                        globalRelaySMTPServerName
                    }
                    {
                        this.state.globalRelayCustomerType === 'CUSTOM' &&
                        globalRelaySMTPPort
                    }
                </SettingsGroup>
            );
        }

        const dropdownHelpText = (
            <FormattedMarkdownMessage
                {...messages.exportFormat_description}
                values={{
                    url: `${getSiteURL()}/admin_console/environment/file_storage`,
                    lineBreak: '\n',
                }}
            />
        );

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableComplianceExport'
                    label={<FormattedMessage {...messages.complianceExportTitle}/>}
                    helpText={
                        <FormattedMessage
                            {...messages.complianceExportDesc}
                            values={{
                                link: (msg: ReactNode) => (
                                    <ExternalLink
                                        href={DocLinks.COMPILANCE_EXPORT}
                                        location='message_export_settings'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.enableComplianceExport}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.EnableExport')}
                    disabled={this.props.isDisabled}
                />

                <TextSetting
                    id='exportJobStartTime'
                    label={<FormattedMessage {...messages.exportJobStartTime_title}/>}
                    placeholder={defineMessage({id: 'admin.complianceExport.exportJobStartTime.example', defaultMessage: 'E.g.: "02:00"'})}
                    helpText={<FormattedMessage {...messages.exportJobStartTime_description}/>}
                    value={this.state.exportJobStartTime}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.DailyRunTime')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />

                <DropdownSetting
                    id='exportFormat'
                    values={exportFormatOptions}
                    label={<FormattedMessage {...messages.exportFormat_title}/>}
                    helpText={dropdownHelpText}
                    value={this.state.exportFormat}
                    onChange={this.handleChange}
                    setByEnv={this.isSetByEnv('DataRetentionSettings.ExportFormat')}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />

                {globalRelaySettings}

                <JobsTable
                    jobType={JobTypes.MESSAGE_EXPORT}
                    createJobButtonText={<FormattedMessage {...messages.createJob_title}/>}
                    createJobHelpText={<FormattedMessage {...messages.createJob_help}/>}
                    getExtraInfoText={this.getJobDetails}
                    disabled={this.props.isDisabled || !this.state.enableComplianceExport}
                />
            </SettingsGroup>
        );
    };
}

export default injectIntl(MessageExportSettings);
