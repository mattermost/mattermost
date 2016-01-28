// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import crypto from 'crypto';

import {injectIntl, intlShape, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    warning: {
        id: 'admin.sql.warning',
        defaultMessage: 'Warning: re-generating this salt may cause some columns in the database to return empty results.'
    },
    maxConnectionsExample: {
        id: 'admin.sql.maxConnectionsExample',
        defaultMessage: 'Ex "10"'
    },
    maxOpenExample: {
        id: 'admin.sql.maxOpenExample',
        defaultMessage: 'Ex "10"'
    },
    keyExample: {
        id: 'admin.sql.keyExample',
        defaultMessage: 'Ex "gxHVDcKUyP2y1eiyW8S8na1UYQAfq6J6"'
    },
    saving: {
        id: 'admin.sql.saving',
        defaultMessage: 'Saving Config...'
    }
});

class SqlSettings extends React.Component {
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
        config.SqlSettings.Trace = ReactDOM.findDOMNode(this.refs.Trace).checked;
        config.SqlSettings.AtRestEncryptKey = ReactDOM.findDOMNode(this.refs.AtRestEncryptKey).value.trim();

        if (config.SqlSettings.AtRestEncryptKey === '') {
            config.SqlSettings.AtRestEncryptKey = crypto.randomBytes(256).toString('base64').substring(0, 32);
            ReactDOM.findDOMNode(this.refs.AtRestEncryptKey).value = config.SqlSettings.AtRestEncryptKey;
        }

        var MaxOpenConns = 10;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.MaxOpenConns).value, 10))) {
            MaxOpenConns = parseInt(ReactDOM.findDOMNode(this.refs.MaxOpenConns).value, 10);
        }
        config.SqlSettings.MaxOpenConns = MaxOpenConns;
        ReactDOM.findDOMNode(this.refs.MaxOpenConns).value = MaxOpenConns;

        var MaxIdleConns = 10;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.MaxIdleConns).value, 10))) {
            MaxIdleConns = parseInt(ReactDOM.findDOMNode(this.refs.MaxIdleConns).value, 10);
        }
        config.SqlSettings.MaxIdleConns = MaxIdleConns;
        ReactDOM.findDOMNode(this.refs.MaxIdleConns).value = MaxIdleConns;

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

        var cfm = global.window.confirm(this.props.intl.formatMessage(holders.warning));
        if (cfm === false) {
            return;
        }

        ReactDOM.findDOMNode(this.refs.AtRestEncryptKey).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
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
                        <h4 className='banner__heading'>
                            <FormattedMessage
                                id='admin.sql.noteTitle'
                                defaultMessage='Note:'
                            />
                        </h4>
                        <p>
                            <FormattedMessage
                                id='admin.sql.noteDescription'
                                defaultMessage='Changing properties in this section will require a server restart before taking effect.'
                            />
                        </p>
                    </div>
                </div>

                <h3>
                    <FormattedMessage
                        id='admin.sql.title'
                        defaultMessage='SQL Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='DriverName'
                        >
                            <FormattedMessage
                                id='admin.sql.driverName'
                                defaultMessage='Driver Name:'
                            />
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
                            <FormattedMessage
                                id='admin.sql.dataSource'
                                defaultMessage='Data Source:'
                            />
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
                            <FormattedMessage
                                id='admin.sql.replicas'
                                defaultMessage='Data Source Replicas:'
                            />
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
                            <FormattedMessage
                                id='admin.sql.maxConnectionsTitle'
                                defaultMessage='Maximum Idle Connections:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxIdleConns'
                                ref='MaxIdleConns'
                                placeholder={formatMessage(holders.maxConnectionsExample)}
                                defaultValue={this.props.config.SqlSettings.MaxIdleConns}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.sql.maxConnectionsDescription'
                                    defaultMessage='Maximum number of idle connections held open to the database.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaxOpenConns'
                        >
                            <FormattedMessage
                                id='admin.sql.maxOpenTitle'
                                defaultMessage='Maximum Open Connections:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaxOpenConns'
                                ref='MaxOpenConns'
                                placeholder={formatMessage(holders.maxOpenExample)}
                                defaultValue={this.props.config.SqlSettings.MaxOpenConns}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.sql.maxOpenDescription'
                                    defaultMessage='Maximum number of open connections held open to the database.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AtRestEncryptKey'
                        >
                            <FormattedMessage
                                id='admin.sql.keyTitle'
                                defaultMessage='At Rest Encrypt Key:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AtRestEncryptKey'
                                ref='AtRestEncryptKey'
                                placeholder={formatMessage(holders.keyExample)}
                                defaultValue={this.props.config.SqlSettings.AtRestEncryptKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.sql.keyDescription'
                                    defaultMessage='32-character salt available to encrypt and decrypt sensitive fields in database.'
                                />
                            </p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerate}
                                >
                                    <FormattedMessage
                                        id='admin.sql.regenerate'
                                        defaultMessage='Re-Generate'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Trace'
                        >
                            <FormattedMessage
                                id='admin.sql.traceTitle'
                                defaultMessage='Trace: '
                            />
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
                                    <FormattedMessage
                                        id='admin.sql.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Trace'
                                    value='false'
                                    defaultChecked={!this.props.config.SqlSettings.Trace}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.sql.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.sql.traceDescription'
                                    defaultMessage='(Development Mode) When true, executing SQL statements are written to the log.'
                                />
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.sql.save'
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

SqlSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(SqlSettings);