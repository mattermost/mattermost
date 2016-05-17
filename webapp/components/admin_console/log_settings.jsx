// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export default class LogSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            enableConsole: props.config.LogSettings.EnableConsole,
            consoleLevel: props.config.LogSettings.ConsoleLevel,
            enableFile: props.config.LogSettings.EnableFile,
            fileLevel: props.config.LogSettings.FileLevel,
            fileLocation: props.config.LogSettings.FileLocation,
            fileFormat: props.config.LogSettings.FileFormat
        });
    }

    getConfigFromState(config) {
        config.LogSettings.EnableConsole = this.state.enableConsole;
        config.LogSettings.ConsoleLevel = this.state.consoleLevel;
        config.LogSettings.EnableFile = this.state.enableFile;
        config.LogSettings.FileLevel = this.state.fileLevel;
        config.LogSettings.FileLocation = this.state.fileLocation;
        config.LogSettings.FileFormat = this.state.fileFormat;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.general.title'
                    defaultMessage='General Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        const logLevels = [
            {value: 'DEBUG', text: 'DEBUG'},
            {value: 'INFO', text: 'INFO'},
            {value: 'ERROR', text: 'ERROR'}
        ];

        return (
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.general.log'
                        defaultMessage='Logging'
                    />

                }
            >
                <BooleanSetting
                    id='enableConsole'
                    label={
                        <FormattedMessage
                            id='admin.log.consoleTitle'
                            defaultMessage='Log To The Console: '
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
                            defaultMessage='Log To File: '
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
                            defaultMessage='File Location:'
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
                            defaultMessage='File Format:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.log.formatPlaceholder', 'Enter your file format')}
                    helpText={this.renderFileFormatHelpText()}
                    value={this.state.fileFormat}
                    onChange={this.handleChange}
                    disabled={!this.state.enableFile}
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
                            <td className='help-text'>{'%T'}</td><td className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatTime'
                                    defaultMessage='Time (15:04:05 MST)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className='help-text'>{'%D'}</td><td className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatDateLong'
                                    defaultMessage='Date (2006/01/02)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className='help-text'>{'%d'}</td><td className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatDateShort'
                                    defaultMessage='Date (01/02/06)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className='help-text'>{'%L'}</td><td className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatLevel'
                                    defaultMessage='Level (DEBG, INFO, EROR)'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className='help-text'>{'%S'}</td><td className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatSource'
                                    defaultMessage='Source'
                                />
                            </td>
                        </tr>
                        <tr>
                            <td className='help-text'>{'%M'}</td><td className='help-text'>
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