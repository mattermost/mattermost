// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');

export default class LogSettings extends React.Component {
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
        config.LogSettings.EnableConsole = React.findDOMNode(this.refs.consoleEnable).checked;
        config.LogSettings.ConsoleLevel = React.findDOMNode(this.refs.consoleLevel).value;
        config.LogSettings.EnableFile = React.findDOMNode(this.refs.fileEnable).checked;
        config.LogSettings.FileLevel = React.findDOMNode(this.refs.fileLevel).value;
        config.LogSettings.FileLocation = React.findDOMNode(this.refs.fileLocation).value.trim();
        config.LogSettings.FileFormat = React.findDOMNode(this.refs.fileFormat).value.trim();

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
                <h3>{'Log Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='consoleEnable'
                        >
                            {'Log To The Console: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='consoleEnable'
                                    value='false'
                                    defaultChecked={!this.props.config.LogSettings.EnableConsole}
                                    onChange={this.handleChange.bind(this, 'console_false')}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'Typically set to false in production. Developers may set this field to true to output log messages to console based on the console level option.  If true, server writes messages to the standard output stream (stdout).'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='consoleLevel'
                        >
                            {'Console Log Level:'}
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
                            <p className='help-text'>{'This setting determines the level of detail at which log events are written to the console. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                        >
                            {'Log To File: '}
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
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='fileEnable'
                                    value='false'
                                    defaultChecked={!this.props.config.LogSettings.EnableFile}
                                    onChange={this.handleChange.bind(this, 'file_false')}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'Typically set to true in production.  When true, log files are written to the log file specified in file location field below.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileLevel'
                        >
                            {'File Log Level:'}
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
                            <p className='help-text'>{'This setting determines the level of detail at which log events are written to the log file. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileLocation'
                        >
                            {'File Location:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='fileLocation'
                                ref='fileLocation'
                                placeholder='Enter your file location'
                                defaultValue={this.props.config.LogSettings.FileLocation}
                                onChange={this.handleChange}
                                disabled={!this.state.fileEnable}
                            />
                            <p className='help-text'>{'File to which log files are written. If blank, will be set to ./logs/mattermost, which writes logs to mattermost.log. Log rotation is enabled and every 10,000 lines of log information is written to new files stored in the same directory, for example mattermost.2015-09-23.001, mattermost.2015-09-23.002, and so forth.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='fileFormat'
                        >
                            {'File Format:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='fileFormat'
                                ref='fileFormat'
                                placeholder='Enter your file format'
                                defaultValue={this.props.config.LogSettings.FileFormat}
                                onChange={this.handleChange}
                                disabled={!this.state.fileEnable}
                            />
                            <p className='help-text'>
                                {'Format of log message output. If blank will be set to "[%D %T] [%L] %M", where:'}
                                <div className='help-text'>
                                    <table
                                        className='table table-bordered'
                                        cellPadding='5'
                                    >
                                        <tr><td className='help-text'>{'%T'}</td><td className='help-text'>{'Time (15:04:05 MST)'}</td></tr>
                                        <tr><td className='help-text'>{'%D'}</td><td className='help-text'>{'Date (2006/01/02)'}</td></tr>
                                        <tr><td className='help-text'>{'%d'}</td><td className='help-text'>{'Date (01/02/06)'}</td></tr>
                                        <tr><td className='help-text'>{'%L'}</td><td className='help-text'>{'Level (DEBG, INFO, EROR)'}</td></tr>
                                        <tr><td className='help-text'>{'%S'}</td><td className='help-text'>{'Source'}</td></tr>
                                        <tr><td className='help-text'>{'%M'}</td><td className='help-text'>{'Message'}</td></tr>
                                    </table>
                                </div>
                            </p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> Saving Config...'}
                            >
                                {'Save'}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        );
    }
}

LogSettings.propTypes = {
    config: React.PropTypes.object
};
