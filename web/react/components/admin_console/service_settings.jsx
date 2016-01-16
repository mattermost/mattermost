// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages, FormattedHTMLMessage} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

const DefaultSessionLength = 30;
const DefaultMaximumLoginAttempts = 10;
const DefaultSessionCacheInMinutes = 10;

const messages = defineMessages({
    title: {
        id: 'admin.service.title',
        defaultMessage: 'Service Settings'
    },
    true: {
        id: 'admin.service.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.service.false',
        defaultMessage: 'false'
    },
    listenTitle: {
        id: 'admin.service.listenAddress',
        defaultMessage: 'Listen Address:'
    },
    listenExample: {
        id: 'admin.service.listenExample',
        defaultMessage: 'Ex ":8065"'
    },
    listenDescription: {
        id: 'admin.service.listenDescription',
        defaultMessage: 'The address to which to bind and listen. Entering ":8065" will bind to all interfaces or you can choose one like "127.0.0.1:8065".  Changing this will require a server restart before taking effect.'
    },
    attemptsTitle: {
        id: 'admin.service.attemptTitle',
        defaultMessage: 'Maximum Login Attempts:'
    },
    attemptExample: {
        id: 'admin.service.attemptExample',
        defaultMessage: 'Ex "10"'
    },
    attemptDescription: {
        id: 'admin.service.attemptDescription',
        defaultMessage: 'Login attempts allowed before user is locked out and required to reset password via email.'
    },
    segmentTitle: {
        id: 'admin.service.segmentTitle',
        defaultMessage: 'Segment Developer Key:'
    },
    segmentExample: {
        id: 'admin.service.segmentExample',
        defaultMessage: 'Ex "g3fgGOXJAQ43QV7rAh6iwQCkV4cA1Gs"'
    },
    segmentDescription: {
        id: 'admin.service.segmentDescription',
        defaultMessage: 'For users running a SaaS services, sign up for a key at Segment.com to track metrics.'
    },
    googleTitle: {
        id: 'admin.service.googleTitle',
        defaultMessage: 'Google Developer Key:'
    },
    googleExample: {
        id: 'admin.service.googleExample',
        defaultMessage: 'Ex "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"'
    },
    googleDescription: {
        id: 'admin.service.googleDescription',
        defaultMessage: 'Set this key to enable embedding of YouTube video previews based on hyperlinks appearing in messages or comments. Instructions to obtain a key available at <a href="https://www.youtube.com/watch?v=Im69kzhpR3I" target="_blank">https://www.youtube.com/watch?v=Im69kzhpR3I</a>. Leaving the field blank disables the automatic generation of YouTube video previews from links.'
    },
    webhooksTitle: {
        id: 'admin.service.webhooksTitle',
        defaultMessage: 'Enable Incoming Webhooks: '
    },
    webhooksDescription: {
        id: 'admin.service.webhooksDescription',
        defaultMessage: 'When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag.'
    },
    overrideTitle: {
        id: 'admin.service.overrideTitle',
        defaultMessage: 'Enable Overriding Usernames from Webhooks: '
    },
    overrideDescription: {
        id: 'admin.service.overrideDescription',
        defaultMessage: 'When true, webhooks will be allowed to change the username they are posting as. Note, combined with allowing icon overriding, this could open users up to phishing attacks.'
    },
    iconTitle: {
        id: 'admin.service.iconTitle',
        defaultMessage: 'Enable Overriding Icon from Webhooks: '
    },
    iconDescription: {
        id: 'admin.service.iconDescription',
        defaultMessage: 'When true, webhooks will be allowed to change the icon they post with. Note, combined with allowing username overriding, this could open users up to phishing attacks.'
    },
    testingTitle: {
        id: 'admin.service.testingTitle',
        defaultMessage: 'Enable Testing: '
    },
    testingDescription: {
        id: 'admin.service.testingDescription',
        defaultMessage: '(Developer Option) When true, /loadtest slash command is enabled to load test accounts and test data. Changing this will require a server restart before taking effect.'
    },
    saving: {
        id: 'admin.service.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.service.save',
        defaultMessage: 'Save'
    },
    outWebhooksTitle: {
        id: 'admin.service.outWebhooksTitle',
        defaultMessage: 'Enable Outgoing Webhooks: '
    },
    outWebhooksDesc: {
        id: 'admin.service.outWebhooksDesc',
        defaultMessage: 'When true, outgoing webhooks will be allowed.'
    },
    securityTitle: {
        id: 'admin.service.securityTitle',
        defaultMessage: 'Enable Security Alerts: '
    },
    securityDesc: {
        id: 'admin.service.securityDesc',
        defaultMessage: 'When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.'
    },
    developerDesc: {
        id: 'admin.service.developerDesc',
        defaultMessage: '(Developer Option) When true, extra information around errors will be displayed in the UI.'
    },
    developerTitle: {
        id: 'admin.service.developerTitle',
        defaultMessage: 'Enable Developer Mode: '
    },
    webSessionDays: {
        id: 'admin.service.webSessionDays',
        defaultMessage: 'Session Length for Web in Days:'
    },
    webSessionDaysDesc: {
        id: 'admin.service.webSessionDaysDesc',
        defaultMessage: 'The web session will expire after the number of days specified and will require a user to login again.'
    },
    sessionDaysEx: {
        id: 'admin.service.sessionDaysEx',
        defaultMessage: 'Ex "30"'
    },
    mobileSessionDays: {
        id: 'admin.service.mobileSessionDays',
        defaultMessage: 'Session Length for Mobile Device in Days:'
    },
    mobileSessionDaysDesc: {
        id: 'admin.service.mobileSessionDaysDesc',
        defaultMessage: 'The native mobile session will expire after the number of days specified and will require a user to login again.'
    },
    ssoSessionDays: {
        id: 'admin.service.ssoSessionDays',
        defaultMessage: 'Session Length for SSO in Days:'
    },
    ssoSessionDaysDesc: {
        id: 'admin.service.ssoSessionDaysDesc',
        defaultMessage: 'The SSO session will expire after the number of days specified and will require a user to login again.'
    },
    sessionCache: {
        id: 'admin.service.sessionCache',
        defaultMessage: 'Session Cache in Minutes:'
    },
    sessionCacheDesc: {
        id: 'admin.service.sessionCacheDesc',
        defaultMessage: 'The number of minutes to cache a session in memory.'
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

                <h3>{formatMessage(messages.title)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ListenAddress'
                        >
                            {formatMessage(messages.listenTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='ListenAddress'
                                ref='ListenAddress'
                                placeholder={formatMessage(messages.listenExample)}
                                defaultValue={this.props.config.ServiceSettings.ListenAddress}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.listenDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='MaximumLoginAttempts'
                        >
                            {formatMessage(messages.attemptsTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='MaximumLoginAttempts'
                                ref='MaximumLoginAttempts'
                                placeholder={formatMessage(messages.attemptExample)}
                                defaultValue={this.props.config.ServiceSettings.MaximumLoginAttempts}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.attemptDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SegmentDeveloperKey'
                        >
                            {formatMessage(messages.segmentTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SegmentDeveloperKey'
                                ref='SegmentDeveloperKey'
                                placeholder={formatMessage(messages.segmentExample)}
                                defaultValue={this.props.config.ServiceSettings.SegmentDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.segmentDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='GoogleDeveloperKey'
                        >
                            {formatMessage(messages.googleTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='GoogleDeveloperKey'
                                ref='GoogleDeveloperKey'
                                placeholder={formatMessage(messages.googleExample)}
                                defaultValue={this.props.config.ServiceSettings.GoogleDeveloperKey}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>
                                <FormattedHTMLMessage id='admin.service.googleDescription' />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableIncomingWebhooks'
                        >
                            {formatMessage(messages.webhooksTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableIncomingWebhooks'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableIncomingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.webhooksDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableOutgoingWebhooks'
                        >
                            {formatMessage(messages.outWebhooksTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableOutgoingWebhooks'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableOutgoingWebhooks}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.outWebhooksDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostUsernameOverride'
                        >
                            {formatMessage(messages.overrideTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostUsernameOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostUsernameOverride}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.overrideDescription)}</p>
                        </div>
                    </div>

                     <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnablePostIconOverride'
                        >
                            {formatMessage(messages.iconTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnablePostIconOverride'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnablePostIconOverride}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.iconDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableTesting'
                        >
                            {formatMessage(messages.testingTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableTesting'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableTesting}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.testingDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableDeveloper'
                        >
                            {formatMessage(messages.developerTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableDeveloper'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableDeveloper}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.developerDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EnableSecurityFixAlert'
                        >
                            {formatMessage(messages.securityTitle)}
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
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='EnableSecurityFixAlert'
                                    value='false'
                                    defaultChecked={!this.props.config.ServiceSettings.EnableSecurityFixAlert}
                                    onChange={this.handleChange}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.securityDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthWebInDays'
                        >
                            {formatMessage(messages.webSessionDays)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthWebInDays'
                                ref='SessionLengthWebInDays'
                                placeholder={formatMessage(messages.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthWebInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.webSessionDaysDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthMobileInDays'
                        >
                            {formatMessage(messages.mobileSessionDays)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthMobileInDays'
                                ref='SessionLengthMobileInDays'
                                placeholder={formatMessage(messages.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthMobileInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.mobileSessionDaysDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionLengthSSOInDays'
                        >
                            {formatMessage(messages.ssoSessionDays)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionLengthSSOInDays'
                                ref='SessionLengthSSOInDays'
                                placeholder={formatMessage(messages.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionLengthSSOInDays}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.ssoSessionDaysDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SessionCacheInMinutes'
                        >
                            {formatMessage(messages.sessionCache)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SessionCacheInMinutes'
                                ref='SessionCacheInMinutes'
                                placeholder={formatMessage(messages.sessionDaysEx)}
                                defaultValue={this.props.config.ServiceSettings.SessionCacheInMinutes}
                                onChange={this.handleChange}
                            />
                            <p className='help-text'>{formatMessage(messages.sessionCacheDesc)}</p>
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
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(messages.saving)}
                            >
                                {formatMessage(messages.save)}
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