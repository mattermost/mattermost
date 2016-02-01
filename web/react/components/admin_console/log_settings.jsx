// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    locationPlaceholder: {
        id: 'admin.log.locationPlaceholder',
        defaultMessage: 'Enter your file location'
    },
    formatPlaceholder: {
        id: 'admin.log.formatPlaceholder',
        defaultMessage: 'Enter your file format'
    },
    saving: {
        id: 'admin.log.saving',
        defaultMessage: 'Saving Config...'
    }
});

class LogSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.state = {
            consoleEnable: this.props.config.LogSettings.EnableConsole,
            fileEnable: this.props.config.LogSettings.EnableFile,
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'console_true') {
            s.consoleEnable = true;
        }

        if (action === 'console_false') {
            s.consoleEnable = false;
        }

        if (action === 'file_true') {
            s.fileEnable = true;
        }

        if (action === 'file_false') {
            s.fileEnable = false;
        }

        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.LogSettings.EnableConsole = ReactDOM.findDOMNode(this.refs.consoleEnable).checked;
        config.LogSettings.ConsoleLevel = ReactDOM.findDOMNode(this.refs.consoleLevel).value;
        config.LogSettings.EnableFile = ReactDOM.findDOMNode(this.refs.fileEnable).checked;
        config.LogSettings.FileLevel = ReactDOM.findDOMNode(this.refs.fileLevel).value;
        config.LogSettings.FileLocation = ReactDOM.findDOMNode(this.refs.fileLocation).value.trim();
        config.LogSettings.FileFormat = ReactDOM.findDOMNode(this.refs.fileFormat).value.trim();

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    consoleEnable: config.LogSettings.EnableConsole,
                    fileEnable: config.LogSettings.EnableFile,
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    consoleEnable: config.LogSettings.EnableConsole,
                    fileEnable: config.LogSettings.EnableFile,
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }

    render() {
        const {formatMessage} = this.props.intl;
        var serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        var saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.log.logSettings'
                        defaultMessage='Log Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='consoleEnable'
                        >
                            <FormattedMessage
                                id='admin.log.consoleTitle'
                                defaultMessage='Log To The Console: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='consoleEnable'
                                    value='true'
                                    ref='consoleEnable'
                                    defaultChecked={this.props.config.LogSettings.EnableConsole}
                                    onChange={this.handleChange.bind(this, 'console_true')}
                                />
                                    <FormattedMessage
                                        id='admin.log.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='consoleEnable'
                                    value='false'
                                    defaultChecked={!this.props.config.LogSettings.EnableConsole}
                                    onChange={this.handleChange.bind(this, 'console_false')}
                                />
                                    <FormattedMessage
                                        id='admin.log.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.log.consoleDescription'
                                    defaultMessage='Typically set to false in production. Developers may set this field to true to output log messages to console based on the console level option.  If true, server writes messages to the standard output stream (stdout).'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='consoleLevel'
                        >
                            <FormattedMessage
                                id='admin.log.levelTitle'
                                defaultMessage='Console Log Level:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='consoleLevel'
                                ref='consoleLevel'
                                defaultValue={this.props.config.LogSettings.consoleLevel}
                                onChange={this.handleChange}
                                disabled={!this.state.consoleEnable}
                            >
                                <option value='DEBUG'>{'DEBUG'}</option>
                                <option value='INFO'>{'INFO'}</option>
                                <option value='ERROR'>{'ERROR'}</option>
                            </select>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.log.levelDescription'
                                    defaultMessage='This setting determines the level of detail at which log events are written to the console. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            <FormattedMessage
                                id='admin.log.fileTitle'
                                defaultMessage='Log To File: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='fileEnable'
                                    ref='fileEnable'
                                    value='true'
                                    defaultChecked={this.props.config.LogSettings.EnableFile}
                                    onChange={this.handleChange.bind(this, 'file_true')}
                                />
                                    <FormattedMessage
                                        id='admin.log.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='fileEnable'
                                    value='false'
                                    defaultChecked={!this.props.config.LogSettings.EnableFile}
                                    onChange={this.handleChange.bind(this, 'file_false')}
                                />
                                    <FormattedMessage
                                        id='admin.log.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.log.fileDescription'
                                    defaultMessage='Typically set to true in production.  When true, log files are written to the log file specified in file location field below.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileLevel'
                        >
                            <FormattedMessage
                                id='admin.log.fileLevelTitle'
                                defaultMessage='File Log Level:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='fileLevel'
                                ref='fileLevel'
                                defaultValue={this.props.config.LogSettings.FileLevel}
                                onChange={this.handleChange}
                                disabled={!this.state.fileEnable}
                            >
                                <option value='DEBUG'>{'DEBUG'}</option>
                                <option value='INFO'>{'INFO'}</option>
                                <option value='ERROR'>{'ERROR'}</option>
                            </select>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.log.fileLevelDescription'
                                    defaultMessage='This setting determines the level of detail at which log events are written to the log file. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileLocation'
                        >
                            <FormattedMessage
                                id='admin.log.locationTitle'
                                defaultMessage='File Location:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='fileLocation'
                                ref='fileLocation'
                                placeholder={formatMessage(holders.locationPlaceholder)}
                                defaultValue={this.props.config.LogSettings.FileLocation}
                                onChange={this.handleChange}
                                disabled={!this.state.fileEnable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.log.locationDescription'
                                    defaultMessage='File to which log files are written. If blank, will be set to ./logs/mattermost, which writes logs to mattermost.log. Log rotation is enabled and every 10,000 lines of log information is written to new files stored in the same directory, for example mattermost.2015-09-23.001, mattermost.2015-09-23.002, and so forth.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileFormat'
                        >
                            <FormattedMessage
                                id='admin.log.formatTitle'
                                defaultMessage='File Format:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='fileFormat'
                                ref='fileFormat'
                                placeholder={formatMessage(holders.formatPlaceholder)}
                                defaultValue={this.props.config.LogSettings.FileFormat}
                                onChange={this.handleChange}
                                disabled={!this.state.fileEnable}
                            />
                            <div className='help-text'>
                                <FormattedMessage
                                    id='admin.log.formatDescription'
                                    defaultMessage='Format of log message output. If blank will be set to "[%D %T] [%L] %M", where:'
                                />
                                <div className='help-text'>
                                    <table
                                        className='table table-bordered'
                                        cellPadding='5'
                                    >
                                        <tbody>
                                            <tr><td className='help-text'>{'%T'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatTime'
                                                    defaultMessage='Time (15:04:05 MST)'
                                                />
                                            </td></tr>
                                            <tr><td className='help-text'>{'%D'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatDateLong'
                                                    defaultMessage='Date (2006/01/02)'
                                                />
                                            </td></tr>
                                            <tr><td className='help-text'>{'%d'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatDateShort'
                                                    defaultMessage='Date (01/02/06)'
                                                />
                                            </td></tr>
                                            <tr><td className='help-text'>{'%L'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatLevel'
                                                    defaultMessage='Level (DEBG, INFO, EROR)'
                                                />
                                            </td></tr>
                                            <tr><td className='help-text'>{'%S'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatSource'
                                                    defaultMessage='Source'
                                                />
                                            </td></tr>
                                            <tr><td className='help-text'>{'%M'}</td><td className='help-text'>
                                                <FormattedMessage
                                                    id='admin.log.formatMessage'
                                                    defaultMessage='Message'
                                                />
                                            </td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={!this.state.saveNeeded}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.log.save'
                                    defaultMessage='Save'
                                />
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

LogSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(LogSettings);