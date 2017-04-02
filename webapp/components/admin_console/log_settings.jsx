// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class LogSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.LogSettings.EnableConsole = this.state.enableConsole;
        config.LogSettings.ConsoleLevel = this.state.consoleLevel;
        config.LogSettings.EnableFile = this.state.enableFile;
        config.LogSettings.FileLevel = this.state.fileLevel;
        config.LogSettings.FileLocation = this.state.fileLocation;
        config.LogSettings.FileFormat = this.state.fileFormat;
        config.LogSettings.EnableWebhookDebugging = this.state.enableWebhookDebugging;
        config.LogSettings.EnableDiagnostics = this.state.enableDiagnostics;

        return config;
    }

    getStateFromConfig(config) {
        return {
            enableConsole: config.LogSettings.EnableConsole,
            consoleLevel: config.LogSettings.ConsoleLevel,
            enableFile: config.LogSettings.EnableFile,
            fileLevel: config.LogSettings.FileLevel,
            fileLocation: config.LogSettings.FileLocation,
            fileFormat: config.LogSettings.FileFormat,
            enableWebhookDebugging: config.LogSettings.EnableWebhookDebugging,
            enableDiagnostics: config.LogSettings.EnableDiagnostics
        };
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.general.log'
                defaultMessage='Logging'
            />
        );
    }

    renderSettings() {
        const logLevels = [
            {value: 'DEBUG', text: 'DEBUG'},
            {value: 'INFO', text: 'INFO'},
            {value: 'ERROR', text: 'ERROR'}
        ];

        return (
            <SettingsGroup>
                <BooleanSetting
                    id='enableConsole'
                    label={
                        <FormattedMessage
                            id='admin.log.consoleTitle'
                            defaultMessage='Output logs to console: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.log.consoleDescription'
                            defaultMessage='Typically set to false in production. Developers may set this field to true to output log messages to console based on the console level option.  If true, server writes messages to the standard output stream (stdout).'
                        />
                    }
                    value={this.state.enableConsole}
                    onChange={this.handleChange}
                />
                <DropdownSetting
                    id='consoleLevel'
                    values={logLevels}
                    label={
                        <FormattedMessage
                            id='admin.log.levelTitle'
                            defaultMessage='Console Log Level:'
                        />
                    }
                    value={this.state.consoleLevel}
                    onChange={this.handleChange}
                    disabled={!this.state.enableConsole}
                    helpText={
                        <FormattedMessage
                            id='admin.log.levelDescription'
                            defaultMessage='This setting determines the level of detail at which log events are written to the console. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'
                        />
                    }
                />
                <BooleanSetting
                    id='enableFile'
                    label={
                        <FormattedMessage
                            id='admin.log.fileTitle'
                            defaultMessage='Output logs to file: '
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.log.fileDescription'
                            defaultMessage='Typically set to true in production.  When true, log files are written to the log file specified in file location field below.'
                        />
                    }
                    value={this.state.enableFile}
                    onChange={this.handleChange}
                />
                <DropdownSetting
                    id='fileLevel'
                    values={logLevels}
                    label={
                        <FormattedMessage
                            id='admin.log.fileLevelTitle'
                            defaultMessage='File Log Level:'
                        />
                    }
                    value={this.state.fileLevel}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFile}
                    helpText={
                        <FormattedMessage
                            id='admin.log.fileLevelDescription'
                            defaultMessage='This setting determines the level of detail at which log events are written to the log file. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'
                        />
                    }
                />
                <TextSetting
                    id='fileLocation'
                    label={
                        <FormattedMessage
                            id='admin.log.locationTitle'
                            defaultMessage='File Log Directory:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.log.locationPlaceholder', 'Enter your file location')}
                    helpText={
                        <FormattedMessage
                            id='admin.log.locationDescription'
                            defaultMessage='File to which log files are written. If blank, will be set to ./logs/mattermost, which writes logs to mattermost.log. Log rotation is enabled and every 10,000 lines of log information is written to new files stored in the same directory, for example mattermost.2015-09-23.001, mattermost.2015-09-23.002, and so forth.'
                        />
                    }
                    value={this.state.fileLocation}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFile}
                />
                <TextSetting
                    id='fileFormat'
                    label={
                        <FormattedMessage
                            id='admin.log.formatTitle'
                            defaultMessage='File Log Format:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.log.formatPlaceholder', 'Enter your file format')}
                    helpText={this.renderFileFormatHelpText()}
                    value={this.state.fileFormat}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFile}
                />
                <BooleanSetting
                    id='enableWebhookDebugging'
                    label={
                        <FormattedMessage
                            id='admin.log.enableWebhookDebugging'
                            defaultMessage='Enable Webhook Debugging:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.log.enableWebhookDebuggingDescription'
                            defaultMessage='You can set this to false to disable the debug logging of all incoming webhook request bodies.'
                        />
                    }
                    value={this.state.enableWebhookDebugging}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableDiagnostics'
                    label={
                        <FormattedMessage
                            id='admin.log.enableDiagnostics'
                            defaultMessage='Enable Diagnostics and Error Reporting:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.log.enableDiagnosticsDescription'
                            defaultMessage='Enable this feature to improve the quality and performance of Mattermost by sending error reporting and diagnostic information to Mattermost, Inc. Read our <a href="https://about.mattermost.com/default-privacy-policy/" target="_blank">privacy policy</a> to learn more.'
                        />
                    }
                    value={this.state.enableDiagnostics}
                    onChange={this.handleChange}
                />
            </SettingsGroup>
        );
    }

    renderFileFormatHelpText() {
        return (
            <div>
                <FormattedMessage
                    id='admin.log.formatDescription'
                    defaultMessage='Format of log message output. If blank will be set to "[%D %T] [%L] %M", where:'
                />
                <table
                    className='table table-bordered'
                    cellPadding='5'
                >
                    <tbody>
                        <tr>
                            <td>{'%T'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatTime'
                                    defaultMessage='Time (15:04:05 MST)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>{'%D'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatDateLong'
                                    defaultMessage='Date (2006/01/02)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>{'%d'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatDateShort'
                                    defaultMessage='Date (01/02/06)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>{'%L'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatLevel'
                                    defaultMessage='Level (DEBG, INFO, EROR)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>{'%S'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatSource'
                                    defaultMessage='Source'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>{'%M'}</td>
                            <td>
                                <FormattedMessage
                                    id='admin.log.formatMessage'
                                    defaultMessage='Message'
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
}
