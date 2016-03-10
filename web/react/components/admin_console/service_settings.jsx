// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const DefaultSessionLength = 30;
const DefaultMaximumLoginAttempts = 10;
const DefaultSessionCacheInMinutes = 10;

var holders = defineMessages({
    listenExample: {
        id: 'admin.service.listenExample',
        defaultMessage: 'Ex ":8065"'
    },
    attemptExample: {
        id: 'admin.service.attemptExample',
        defaultMessage: 'Ex "10"'
    },
    segmentExample: {
        id: 'admin.service.segmentExample',
        defaultMessage: 'Ex "g3fgGOXJAQ43QV7rAh6iwQCkV4cA1Gs"'
    },
    googleExample: {
        id: 'admin.service.googleExample',
        defaultMessage: 'Ex "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"'
    },
    sessionDaysEx: {
        id: 'admin.service.sessionDaysEx',
        defaultMessage: 'Ex "30"'
    },
    corsExample: {
        id: 'admin.service.corsEx',
        defaultMessage: 'http://example.com'
    },
    saving: {
        id: 'admin.service.saving',
        defaultMessage: 'Saving Config...'
    }
});

class ServiceSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

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
        config.ServiceSettings.ListenAddress = ReactDOM.findDOMNode(this.refs.ListenAddress).value.trim();
        if (config.ServiceSettings.ListenAddress === '') {
            config.ServiceSettings.ListenAddress = ':8065';
            ReactDOM.findDOMNode(this.refs.ListenAddress).value = config.ServiceSettings.ListenAddress;
        }

        config.ServiceSettings.SegmentDeveloperKey = ReactDOM.findDOMNode(this.refs.SegmentDeveloperKey).value.trim();
        config.ServiceSettings.GoogleDeveloperKey = ReactDOM.findDOMNode(this.refs.GoogleDeveloperKey).value.trim();
        config.ServiceSettings.EnableIncomingWebhooks = ReactDOM.findDOMNode(this.refs.EnableIncomingWebhooks).checked;
        config.ServiceSettings.EnableOutgoingWebhooks = ReactDOM.findDOMNode(this.refs.EnableOutgoingWebhooks).checked;
        config.ServiceSettings.EnablePostUsernameOverride = ReactDOM.findDOMNode(this.refs.EnablePostUsernameOverride).checked;
        config.ServiceSettings.EnablePostIconOverride = ReactDOM.findDOMNode(this.refs.EnablePostIconOverride).checked;
        config.ServiceSettings.EnableTesting = ReactDOM.findDOMNode(this.refs.EnableTesting).checked;
        config.ServiceSettings.EnableDeveloper = ReactDOM.findDOMNode(this.refs.EnableDeveloper).checked;
        config.ServiceSettings.EnableSecurityFixAlert = ReactDOM.findDOMNode(this.refs.EnableSecurityFixAlert).checked;
        config.ServiceSettings.EnableInsecureOutgoingConnections = ReactDOM.findDOMNode(this.refs.EnableInsecureOutgoingConnections).checked;
        config.ServiceSettings.EnableCommands = ReactDOM.findDOMNode(this.refs.EnableCommands).checked;
        config.ServiceSettings.EnableOnlyAdminIntegrations = ReactDOM.findDOMNode(this.refs.EnableOnlyAdminIntegrations).checked;

        //config.ServiceSettings.EnableOAuthServiceProvider = ReactDOM.findDOMNode(this.refs.EnableOAuthServiceProvider).checked;

        var MaximumLoginAttempts = DefaultMaximumLoginAttempts;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.MaximumLoginAttempts).value, 10))) {
            MaximumLoginAttempts = parseInt(ReactDOM.findDOMNode(this.refs.MaximumLoginAttempts).value, 10);
        }
        if (MaximumLoginAttempts < 1) {
            MaximumLoginAttempts = 1;
        }
        config.ServiceSettings.MaximumLoginAttempts = MaximumLoginAttempts;
        ReactDOM.findDOMNode(this.refs.MaximumLoginAttempts).value = MaximumLoginAttempts;

        var SessionLengthWebInDays = DefaultSessionLength;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthWebInDays).value, 10))) {
            SessionLengthWebInDays = parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthWebInDays).value, 10);
        }
        if (SessionLengthWebInDays < 1) {
            SessionLengthWebInDays = 1;
        }
        config.ServiceSettings.SessionLengthWebInDays = SessionLengthWebInDays;
        ReactDOM.findDOMNode(this.refs.SessionLengthWebInDays).value = SessionLengthWebInDays;

        var SessionLengthMobileInDays = DefaultSessionLength;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthMobileInDays).value, 10))) {
            SessionLengthMobileInDays = parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthMobileInDays).value, 10);
        }
        if (SessionLengthMobileInDays < 1) {
            SessionLengthMobileInDays = 1;
        }
        config.ServiceSettings.SessionLengthMobileInDays = SessionLengthMobileInDays;
        ReactDOM.findDOMNode(this.refs.SessionLengthMobileInDays).value = SessionLengthMobileInDays;

        var SessionLengthSSOInDays = DefaultSessionLength;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthSSOInDays).value, 10))) {
            SessionLengthSSOInDays = parseInt(ReactDOM.findDOMNode(this.refs.SessionLengthSSOInDays).value, 10);
        }
        if (SessionLengthSSOInDays < 1) {
            SessionLengthSSOInDays = 1;
        }
        config.ServiceSettings.SessionLengthSSOInDays = SessionLengthSSOInDays;
        ReactDOM.findDOMNode(this.refs.SessionLengthSSOInDays).value = SessionLengthSSOInDays;

        var SessionCacheInMinutes = DefaultSessionCacheInMinutes;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.SessionCacheInMinutes).value, 10))) {
            SessionCacheInMinutes = parseInt(ReactDOM.findDOMNode(this.refs.SessionCacheInMinutes).value, 10);
        }
        if (SessionCacheInMinutes < -1) {
            SessionCacheInMinutes = -1;
        }
        config.ServiceSettings.SessionCacheInMinutes = SessionCacheInMinutes;
        ReactDOM.findDOMNode(this.refs.SessionCacheInMinutes).value = SessionCacheInMinutes;

        config.ServiceSettings.AllowCorsFrom = ReactDOM.findDOMNode(this.refs.AllowCorsFrom).value.trim();

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
                        id='admin.service.title'
                        defaultMessage='Service Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ListenAddress'
                        >
                            <FormattedMessage
                                id='admin.service.listenAddress'
                                defaultMessage='Listen Address:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ListenAddress'
                                ref='ListenAddress'
                                placeholder={formatMessage(holders.listenExample)}
                                defaultValue={this.props.config.ServiceSettings.ListenAddress}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.listenDescription'
                                    defaultMessage='The address to which to bind and listen. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065".  Changing this will require a server restart before taking effect.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaximumLoginAttempts'
                        >
                            <FormattedMessage
                                id='admin.service.attemptTitle'
                                defaultMessage='Maximum Login Attempts:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaximumLoginAttempts'
                                ref='MaximumLoginAttempts'
                                placeholder={formatMessage(holders.attemptExample)}
                                defaultValue={this.props.config.ServiceSettings.MaximumLoginAttempts}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.attemptDescription'
                                    defaultMessage='Login attempts allowed before user is locked out and required to reset password via email.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SegmentDeveloperKey'
                        >
                            <FormattedMessage
                                id='admin.service.segmentTitle'
                                defaultMessage='Segment Developer Key:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SegmentDeveloperKey'
                                ref='SegmentDeveloperKey'
                                placeholder={formatMessage(holders.segmentExample)}
                                defaultValue={this.props.config.ServiceSettings.SegmentDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.segmentDescription'
                                    defaultMessage='For users running a SaaS services, sign up for a key at Segment.com to track metrics.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='GoogleDeveloperKey'
                        >
                            <FormattedMessage
                                id='admin.service.googleTitle'
                                defaultMessage='Google Developer Key:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='GoogleDeveloperKey'
                                ref='GoogleDeveloperKey'
                                placeholder={formatMessage(holders.googleExample)}
                                defaultValue={this.props.config.ServiceSettings.GoogleDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedHTMLMessage
                                    id='admin.service.googleDescription'
                                    defaultMessage='Set this key to enable embedding of YouTube video previews based on hyperlinks appearing in messages or comments. Instructions to obtain a key available at <a href="https://www.youtube.com/watch?v=Im69kzhpR3I" target="_blank">https://www.youtube.com/watch?v=Im69kzhpR3I</a>. Leaving the field blank disables the automatic generation of YouTube video previews from links.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableIncomingWebhooks'
                        >
                            <FormattedMessage
                                id='admin.service.webhooksTitle'
                                defaultMessage='Enable Incoming Webhooks: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableIncomingWebhooks'
                                    value='true'
                                    ref='EnableIncomingWebhooks'
                                    defaultChecked={this.props.config.ServiceSettings.EnableIncomingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableIncomingWebhooks'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableIncomingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.webhooksDescription'
                                    defaultMessage='When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableOutgoingWebhooks'
                        >
                            <FormattedMessage
                                id='admin.service.outWebhooksTitle'
                                defaultMessage='Enable Outgoing Webhooks: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOutgoingWebhooks'
                                    value='true'
                                    ref='EnableOutgoingWebhooks'
                                    defaultChecked={this.props.config.ServiceSettings.EnableOutgoingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOutgoingWebhooks'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableOutgoingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.outWebhooksDesc'
                                    defaultMessage='When true, outgoing webhooks will be allowed.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableCommands'
                        >
                            <FormattedMessage
                                id='admin.service.cmdsTitle'
                                defaultMessage='Enable Slash Commands: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableCommands'
                                    value='true'
                                    ref='EnableCommands'
                                    defaultChecked={this.props.config.ServiceSettings.EnableCommands}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableCommands'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableCommands}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.cmdsDesc'
                                    defaultMessage='When true, user created slash commands will be allowed.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableOnlyAdminIntegrations'
                        >
                            <FormattedMessage
                                id='admin.service.integrationAdmin'
                                defaultMessage='Enable Integrations for Admin Only: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOnlyAdminIntegrations'
                                    value='true'
                                    ref='EnableOnlyAdminIntegrations'
                                    defaultChecked={this.props.config.ServiceSettings.EnableOnlyAdminIntegrations}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOnlyAdminIntegrations'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableOnlyAdminIntegrations}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.integrationAdminDesc'
                                    defaultMessage='When true, user created integrations can only be created by admins.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostUsernameOverride'
                        >
                            <FormattedMessage
                                id='admin.service.overrideTitle'
                                defaultMessage='Enable Overriding Usernames from Webhooks and Slash Commands: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostUsernameOverride'
                                    value='true'
                                    ref='EnablePostUsernameOverride'
                                    defaultChecked={this.props.config.ServiceSettings.EnablePostUsernameOverride}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostUsernameOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostUsernameOverride}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.overrideDescription'
                                    defaultMessage='When true, webhooks and slash commands will be allowed to change the username they are posting as. Note, combined with allowing icon overriding, this could open users up to phishing attacks.'
                                />
                            </p>
                        </div>
                    </div>

                     <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostIconOverride'
                        >
                            <FormattedMessage
                                id='admin.service.iconTitle'
                                defaultMessage='Enable Overriding Icon from Webhooks and Slash Commands: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostIconOverride'
                                    value='true'
                                    ref='EnablePostIconOverride'
                                    defaultChecked={this.props.config.ServiceSettings.EnablePostIconOverride}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostIconOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostIconOverride}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.iconDescription'
                                    defaultMessage='When true, webhooks and slash commands will be allowed to change the icon they post with. Note, combined with allowing username overriding, this could open users up to phishing attacks.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTesting'
                        >
                            <FormattedMessage
                                id='admin.service.testingTitle'
                                defaultMessage='Enable Testing: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTesting'
                                    value='true'
                                    ref='EnableTesting'
                                    defaultChecked={this.props.config.ServiceSettings.EnableTesting}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTesting'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableTesting}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.testingDescription'
                                    defaultMessage='(Developer Option) When true, /loadtest slash command is enabled to load test accounts and test data. Changing this will require a server restart before taking effect.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableDeveloper'
                        >
                            <FormattedMessage
                                id='admin.service.developerTitle'
                                defaultMessage='Enable Developer Mode: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableDeveloper'
                                    value='true'
                                    ref='EnableDeveloper'
                                    defaultChecked={this.props.config.ServiceSettings.EnableDeveloper}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableDeveloper'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableDeveloper}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.developerDesc'
                                    defaultMessage='(Developer Option) When true, extra information around errors will be displayed in the UI.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableSecurityFixAlert'
                        >
                            <FormattedMessage
                                id='admin.service.securityTitle'
                                defaultMessage='Enable Security Alerts: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableSecurityFixAlert'
                                    value='true'
                                    ref='EnableSecurityFixAlert'
                                    defaultChecked={this.props.config.ServiceSettings.EnableSecurityFixAlert}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableSecurityFixAlert'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableSecurityFixAlert}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.securityDesc'
                                    defaultMessage='When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableInsecureOutgoingConnections'
                        >
                            <FormattedMessage
                                id='admin.service.insecureTlsTitle'
                                defaultMessage='Enable Insecure Outgoing Connections: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableInsecureOutgoingConnections'
                                    value='true'
                                    ref='EnableInsecureOutgoingConnections'
                                    defaultChecked={this.props.config.ServiceSettings.EnableInsecureOutgoingConnections}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableInsecureOutgoingConnections'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableInsecureOutgoingConnections}
                                    onChange={this.handleChange}
                                />
                                    <FormattedMessage
                                        id='admin.service.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.insecureTlsDesc'
                                    defaultMessage='When true, any outgoing HTTPS requests will accept unverified, self-signed certificates. For example, outgoing webhooks to a server with a self-signed TLS certificate, using any domain, will be allowed. Note that this makes these connections susceptible to man-in-the-middle attacks.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='AllowCorsFrom'
                        >
                            <FormattedMessage
                                id='admin.service.corsTitle'
                                defaultMessage='Allow Cross-origin Requests from:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='AllowCorsFrom'
                                ref='AllowCorsFrom'
                                placeholder={formatMessage(holders.corsExample)}
                                defaultValue={this.props.config.ServiceSettings.AllowCorsFrom}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.corsDescription'
                                    defaultMessage='Enable HTTP Cross origin request from a specific domain. Use "*" if you want to allow CORS from any domain or leave it blank to disable it.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthWebInDays'
                        >
                            <FormattedMessage
                                id='admin.service.webSessionDays'
                                defaultMessage='Session Length for Web in Days:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthWebInDays'
                                ref='SessionLengthWebInDays'
                                placeholder={formatMessage(holders.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthWebInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.webSessionDaysDesc'
                                    defaultMessage='The web session will expire after the number of days specified and will require a user to login again.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthMobileInDays'
                        >
                            <FormattedMessage
                                id='admin.service.mobileSessionDays'
                                defaultMessage='Session Length for Mobile Device in Days:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthMobileInDays'
                                ref='SessionLengthMobileInDays'
                                placeholder={formatMessage(holders.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthMobileInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.mobileSessionDaysDesc'
                                    defaultMessage='The native mobile session will expire after the number of days specified and will require a user to login again.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthSSOInDays'
                        >
                            <FormattedMessage
                                id='admin.service.ssoSessionDays'
                                defaultMessage='Session Length for SSO in Days:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthSSOInDays'
                                ref='SessionLengthSSOInDays'
                                placeholder={formatMessage(holders.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthSSOInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.ssoSessionDaysDesc'
                                    defaultMessage='The SSO session will expire after the number of days specified and will require a user to login again.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionCacheInMinutes'
                        >
                            <FormattedMessage
                                id='admin.service.sessionCache'
                                defaultMessage='Session Cache in Minutes:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionCacheInMinutes'
                                ref='SessionCacheInMinutes'
                                placeholder={formatMessage(holders.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionCacheInMinutes}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.service.sessionCacheDesc'
                                    defaultMessage='The number of minutes to cache a session in memory.'
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
                                    id='admin.service.save'
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

// <div className='form-group'>
//     <label
//         className='control-label col-sm-4'
//         htmlFor='EnableOAuthServiceProvider'
//     >
//         {'Enable OAuth Service Provider: '}
//     </label>
//     <div className='col-sm-8'>
//         <label className='radio-inline'>
//             <input
//                 type='radio'
//                 name='EnableOAuthServiceProvider'
//                 value='true'
//                 ref='EnableOAuthServiceProvider'
//                 defaultChecked={this.props.config.ServiceSettings.EnableOAuthServiceProvider}
//                 onChange={this.handleChange}
//             />
//                 {'true'}
//         </label>
//         <label className='radio-inline'>
//             <input
//                 type='radio'
//                 name='EnableOAuthServiceProvider'
//                 value='false'
//                 defaultChecked={!this.props.config.ServiceSettings.EnableOAuthServiceProvider}
//                 onChange={this.handleChange}
//             />
//                 {'false'}
//         </label>
//         <p className='help-text'>{'When enabled Mattermost will act as an OAuth2 Provider.  Changing this will require a server restart before taking effect.'}</p>
//     </div>
// </div>

ServiceSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(ServiceSettings);
