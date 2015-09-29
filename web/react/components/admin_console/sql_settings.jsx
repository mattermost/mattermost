// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Client = require('../../utils/client.jsx');
var AsyncClient = require('../../utils/async_client.jsx');
var crypto = require('crypto');

export default class SqlSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleGenerate = this.handleGenerate.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null
        };
    }

    handleChange() {
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.props.config;
        config.SqlSettings.Trace = React.findDOMNode(this.refs.Trace).checked;
        config.SqlSettings.AtRestEncryptKey = React.findDOMNode(this.refs.AtRestEncryptKey).value.trim();

        if (config.SqlSettings.AtRestEncryptKey === '') {
            config.SqlSettings.AtRestEncryptKey = crypto.randomBytes(256).toString('base64').substring(0, 32);
            React.findDOMNode(this.refs.AtRestEncryptKey).value = config.SqlSettings.AtRestEncryptKey;
        }

        var MaxOpenConns = 10;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.MaxOpenConns).value, 10))) {
            MaxOpenConns = parseInt(React.findDOMNode(this.refs.MaxOpenConns).value, 10);
        }
        config.SqlSettings.MaxOpenConns = MaxOpenConns;
        React.findDOMNode(this.refs.MaxOpenConns).value = MaxOpenConns;

        var MaxIdleConns = 10;
        if (!isNaN(parseInt(React.findDOMNode(this.refs.MaxIdleConns).value, 10))) {
            MaxIdleConns = parseInt(React.findDOMNode(this.refs.MaxIdleConns).value, 10);
        }
        config.SqlSettings.MaxIdleConns = MaxIdleConns;
        React.findDOMNode(this.refs.MaxIdleConns).value = MaxIdleConns;

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    serverError: null,
                    saveNeeded: false
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    serverError: err.message,
                    saveNeeded: true
                });
                $('#save-button').button('reset');
            }
        );
    }

    handleGenerate(e) {
        e.preventDefault();

        var cfm = global.window.confirm('Warning: re-generating this salt may cause some columns in the database to return empty results.');
        if (cfm === false) {
            return;
        }

        React.findDOMNode(this.refs.AtRestEncryptKey).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
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

        var dataSource = '**********' + this.props.config.SqlSettings.DataSource.substring(this.props.config.SqlSettings.DataSource.indexOf('@'));

        var dataSourceReplicas = '';
        this.props.config.SqlSettings.DataSourceReplicas.forEach((replica) => {
            dataSourceReplicas += '[**********' + replica.substring(replica.indexOf('@')) + '] ';
        });

        if (this.props.config.SqlSettings.DataSourceReplicas.length === 0) {
            dataSourceReplicas = 'none';
        }

        return (
            <div className='wrapper--fixed'>

                <div className='banner'>
                    <div className='banner__content'>
                        <h4 className='banner__heading'>{'Note:'}</h4>
                        <p>{'Changing properties in this section will require a server restart before taking effect.'}</p>
                    </div>
                </div>

                <h3>{'SQL Settings'}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DriverName'
                        >
                            {'Driver Name:'}
                        </label>
                        <div className='col-sm-8'>
                            <p className='help-text'>{this.props.config.SqlSettings.DriverName}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DataSource'
                        >
                            {'Data Source:'}
                        </label>
                        <div className='col-sm-8'>
                            <p className='help-text'>{dataSource}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DataSourceReplicas'
                        >
                            {'Data Source Replicas:'}
                        </label>
                        <div className='col-sm-8'>
                            <p className='help-text'>{dataSourceReplicas}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxIdleConns'
                        >
                            {'Maximum Idle Connections:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxIdleConns'
                                ref='MaxIdleConns'
                                placeholder='Ex "10"'
                                defaultValue={this.props.config.SqlSettings.MaxIdleConns}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Maximum number of idle connections held open to the database.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxOpenConns'
                        >
                            {'Maximum Open Connections:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxOpenConns'
                                ref='MaxOpenConns'
                                placeholder='Ex "10"'
                                defaultValue={this.props.config.SqlSettings.MaxOpenConns}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'Maximum number of open connections held open to the database.'}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AtRestEncryptKey'
                        >
                            {'At Rest Encrypt Key:'}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AtRestEncryptKey'
                                ref='AtRestEncryptKey'
                                placeholder='Ex "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"'
                                defaultValue={this.props.config.SqlSettings.AtRestEncryptKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{'32-character salt available to encrypt and decrypt sensitive fields in database.'}</p>
                            <div className='help-text'>
                                <button
                                    className='help-link'
                                    onClick={this.handleGenerate}
                                >
                                    {'Re-Generate'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Trace'
                        >
                            {'Trace: '}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Trace'
                                    value='true'
                                    ref='Trace'
                                    defaultChecked={this.props.config.SqlSettings.Trace}
                                    onChange={this.handleChange}
                                />
                                    {'true'}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Trace'
                                    value='false'
                                    defaultChecked={!this.props.config.SqlSettings.Trace}
                                    onChange={this.handleChange}
                                />
                                    {'false'}
                            </label>
                            <p className='help-text'>{'(Development Mode) When true, executing SQL statements are written to the log.'}</p>
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

SqlSettings.propTypes = {
    config: React.PropTypes.object
};
