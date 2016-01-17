// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import crypto from 'crypto';

const messages = defineMessages({
    emailSuccess: {
        id: 'admin.email.emailSuccess',
        defaultMessage: 'No errors were reported while sending an email.  Please check your inbox to make sure.'
    },
    emailFail: {
        id: 'admin.email.emailFail',
        defaultMessage: 'Connection unsuccessful: '
    },
    emailSettings: {
        id: 'admin.email.emailSettings',
        defaultMessage: 'Email Settings'
    },
    true: {
        id: 'admin.email.true',
        defaultMessage: 'true'
    },
    false: {
        id: 'admin.email.false',
        defaultMessage: 'false'
    },
    allowSignupTitle: {
        id: 'admin.email.allowSignupTitle',
        defaultMessage: 'Allow Sign Up With Email: '
    },
    allowSignupDescription: {
        id: 'admin.email.allowSignupDescription',
        defaultMessage: 'When true, Mattermost allows team creation and account signup using email and password.  This value should be false only when you want to limit signup to a single-sign-on service like OAuth or LDAP.'
    },
    notificationsTitle: {
        id: 'admin.email.notificationsTitle',
        defaultMessage: 'Send Email Notifications: '
    },
    notificationsDescription: {
        id: 'admin.email.notificationsDescription',
        defaultMessage: 'Typically set to true in production. When true, Mattermost attempts to send email notifications. Developers may set this field to false to skip email setup for faster development.\nSetting this to true removes the Preview Mode banner (requires logging out and logging back in after setting is changed).'
    },
    requireVerificationTitle: {
        id: 'admin.email.requireVerificationTitle',
        defaultMessage: 'Require Email Verification: '
    },
    requireVerificationDescription: {
        id: 'admin.email.requireVerificationDescription',
        defaultMessage: 'Typically set to true in production. When true, Mattermost requires email verification after account creation prior to allowing login. Developers may set this field to false so skip sending verification emails for faster development.'
    },
    notificationDisplayTitle: {
        id: 'admin.email.notificationDisplayTitle',
        defaultMessage: 'Notification Display Name:'
    },
    notificationDisplayExample: {
        id: 'admin.email.notificationDisplayExample',
        defaultMessage: 'Ex: "Mattermost Notification", "System", "No-Reply"'
    },
    notificationDisplayDescription: {
        id: 'admin.email.notificationDisplayDescription',
        defaultMessage: 'Display name on email account used when sending notification emails from Mattermost.'
    },
    notificationEmailTitle: {
        id: 'admin.email.notificationEmailTitle',
        defaultMessage: 'Notification Email Address:'
    },
    notificationEmailExample: {
        id: 'admin.email.notificationEmailExample',
        defaultMessage: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"'
    },
    notificationEmailDescription: {
        id: 'admin.email.notificationEmailDescription',
        defaultMessage: 'Email address displayed on email account used when sending notification emails from Mattermost.'
    },
    smtpUsernameTitle: {
        id: 'admin.email.smtpUsernameTitle',
        defaultMessage: 'SMTP Username:'
    },
    smtpUsernameExample: {
        id: 'admin.email.smtpUsernameExample',
        defaultMessage: 'Ex: "admin@yourcompany.com", "AKIADTOVBGERKLCBV"'
    },
    smtpUsernameDescription: {
        id: 'admin.email.smtpUsernameDescription',
        defaultMessage: ' Obtain this credential from administrator setting up your email server.'
    },
    smtpPasswordTitle: {
        id: 'admin.email.smtpPasswordTitle',
        defaultMessage: 'SMTP Password:'
    },
    smtpPasswordExample: {
        id: 'admin.email.smtpPasswordExample',
        defaultMessage: 'Ex: "yourpassword", "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    smtpPasswordDescription: {
        id: 'admin.email.smtpPasswordDescription',
        defaultMessage: ' Obtain this credential from administrator setting up your email server.'
    },
    smtpServerTitle: {
        id: 'admin.email.smtpServerTitle',
        defaultMessage: 'SMTP Server:'
    },
    smtpServerExample: {
        id: 'admin.email.smtpServerExample',
        defaultMessage: 'Ex: "smtp.yourcompany.com", "email-smtp.us-east-1.amazonaws.com"'
    },
    smtpServerDescription: {
        id: 'admin.email.smtpServerDescription',
        defaultMessage: 'Location of SMTP email server.'
    },
    smtpPortTitle: {
        id: 'admin.email.smtpPortTitle',
        defaultMessage: 'SMTP Port:'
    },
    smtpPortExample: {
        id: 'admin.email.smtpPortExample',
        defaultMessage: 'Ex: "25", "465"'
    },
    smtpPortDescription: {
        id: 'admin.email.smtpPortDescription',
        defaultMessage: 'Port of SMTP email server.'
    },
    connectionSecurityTitle: {
        id: 'admin.email.connectionSecurityTitle',
        defaultMessage: 'Connection Security:'
    },
    connectionSecurityNone: {
        id: 'admin.email.connectionSecurityNone',
        defaultMessage: 'None'
    },
    connectionSecurityTls: {
        id: 'admin.email.connectionSecurityTls',
        defaultMessage: 'TLS (Recommended)'
    },
    connectionSecurityStart: {
        id: 'admin.email.connectionSecurityStart',
        defaultMessage: 'STARTTLS'
    },
    connectionSecurityNoneDescription: {
        id: 'admin.email.connectionSecurityNoneDescription',
        defaultMessage: 'Mattermost will send email over an unsecure connection.'
    },
    connectionSecurityTlsDescription: {
        id: 'admin.email.connectionSecurityTlsDescription',
        defaultMessage: 'Encrypts the communication between Mattermost and your email server.'
    },
    connectionSecurityStartDescription: {
        id: 'admin.email.connectionSecurityStartDescription',
        defaultMessage: 'Takes an existing insecure connection and attempts to upgrade it to a secure connection using TLS.'
    },
    connectionSecurityTest: {
        id: 'admin.email.connectionSecurityTest',
        defaultMessage: 'Test Connection'
    },
    inviteSaltTitle: {
        id: 'admin.email.inviteSaltTitle',
        defaultMessage: 'Invite Salt:'
    },
    inviteSaltExample: {
        id: 'admin.email.inviteSaltExample',
        defaultMessage: 'Ex "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9Yo"'
    },
    inviteSaltDescription: {
        id: 'admin.email.inviteSaltDescription',
        defaultMessage: '32-character salt added to signing of email invites. Randomly generated on install. Click "Re-Generate" to create new salt.'
    },
    passwordSaltTitle: {
        id: 'admin.email.passwordSaltTitle',
        defaultMessage: 'Password Reset Salt:'
    },
    passwordSaltExample: {
        id: 'admin.email.passwordSaltExample',
        defaultMessage: 'Ex "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9Yo"'
    },
    passwordSaltDescription: {
        id: 'admin.email.passwordSaltDescription',
        defaultMessage: '32-character salt added to signing of password reset emails. Randomly generated on install. Click "Re-Generate" to create new salt.'
    },
    regenerate: {
        id: 'admin.email.regenerate',
        defaultMessage: 'Re-Generate'
    },
    saving: {
        id: 'admin.email.saving',
        defaultMessage: 'Saving Config...'
    },
    save: {
        id: 'admin.email.save',
        defaultMessage: 'Save'
    },
    pushTitle: {
        id: 'admin.email.pushTitle',
        defaultMessage: 'Send Push Notifications: '
    },
    pushDesc: {
        id: 'admin.email.pushDesc',
        defaultMessage: 'Typically set to true in production. When true, Mattermost attempts to send iOS and Android push notifications through the push notification server.'
    },
    pushServerTitle: {
        id: 'admin.email.pushServerTitle',
        defaultMessage: 'Push Notification Server:'
    },
    pushServerDesc: {
        id: 'admin.email.pushServerDesc',
        defaultMessage: 'Location of Mattermost push notification service you can set up behind your firewall using https://github.com/mattermost/push-proxy. For testing you can use https://push-test.mattermost.com, which connects to the sample Mattermost iOS app in the public Apple AppStore. Please do not use test service for production deployments.'
    },
    testing: {
        id: 'admin.email.testing',
        defaultMessage: 'Testing...'
    }
});

class EmailSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleTestConnection = this.handleTestConnection.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.buildConfig = this.buildConfig.bind(this);
        this.handleGenerateInvite = this.handleGenerateInvite.bind(this);
        this.handleGenerateReset = this.handleGenerateReset.bind(this);

        this.state = {
            sendEmailNotifications: this.props.config.EmailSettings.SendEmailNotifications,
            sendPushNotifications: this.props.config.EmailSettings.SendPushNotifications,
            saveNeeded: false,
            serverError: null,
            emailSuccess: null,
            emailFail: null
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true, serverError: this.state.serverError};

        if (action === 'sendEmailNotifications_true') {
            s.sendEmailNotifications = true;
        }

        if (action === 'sendEmailNotifications_false') {
            s.sendEmailNotifications = false;
        }

        if (action === 'sendPushNotifications_true') {
            s.sendPushNotifications = true;
        }

        if (action === 'sendPushNotifications_false') {
            s.sendPushNotifications = false;
        }

        this.setState(s);
    }

    buildConfig() {
        var config = this.props.config;
        config.EmailSettings.EnableSignUpWithEmail = ReactDOM.findDOMNode(this.refs.allowSignUpWithEmail).checked;
        config.EmailSettings.SendEmailNotifications = ReactDOM.findDOMNode(this.refs.sendEmailNotifications).checked;
        config.EmailSettings.SendPushNotifications = ReactDOM.findDOMNode(this.refs.sendPushNotifications).checked;
        config.EmailSettings.RequireEmailVerification = ReactDOM.findDOMNode(this.refs.requireEmailVerification).checked;
        config.EmailSettings.FeedbackName = ReactDOM.findDOMNode(this.refs.feedbackName).value.trim();
        config.EmailSettings.FeedbackEmail = ReactDOM.findDOMNode(this.refs.feedbackEmail).value.trim();
        config.EmailSettings.SMTPServer = ReactDOM.findDOMNode(this.refs.SMTPServer).value.trim();
        config.EmailSettings.PushNotificationServer = ReactDOM.findDOMNode(this.refs.PushNotificationServer).value.trim();
        config.EmailSettings.SMTPPort = ReactDOM.findDOMNode(this.refs.SMTPPort).value.trim();
        config.EmailSettings.SMTPUsername = ReactDOM.findDOMNode(this.refs.SMTPUsername).value.trim();
        config.EmailSettings.SMTPPassword = ReactDOM.findDOMNode(this.refs.SMTPPassword).value.trim();
        config.EmailSettings.ConnectionSecurity = ReactDOM.findDOMNode(this.refs.ConnectionSecurity).value.trim();

        config.EmailSettings.InviteSalt = ReactDOM.findDOMNode(this.refs.InviteSalt).value.trim();
        if (config.EmailSettings.InviteSalt === '') {
            config.EmailSettings.InviteSalt = crypto.randomBytes(256).toString('base64').substring(0, 32);
            ReactDOM.findDOMNode(this.refs.InviteSalt).value = config.EmailSettings.InviteSalt;
        }

        config.EmailSettings.PasswordResetSalt = ReactDOM.findDOMNode(this.refs.PasswordResetSalt).value.trim();
        if (config.EmailSettings.PasswordResetSalt === '') {
            config.EmailSettings.PasswordResetSalt = crypto.randomBytes(256).toString('base64').substring(0, 32);
            ReactDOM.findDOMNode(this.refs.PasswordResetSalt).value = config.EmailSettings.PasswordResetSalt;
        }

        return config;
    }

    handleGenerateInvite(e) {
        e.preventDefault();
        ReactDOM.findDOMNode(this.refs.InviteSalt).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleGenerateReset(e) {
        e.preventDefault();
        ReactDOM.findDOMNode(this.refs.PasswordResetSalt).value = crypto.randomBytes(256).toString('base64').substring(0, 32);
        var s = {saveNeeded: true, serverError: this.state.serverError};
        this.setState(s);
    }

    handleTestConnection(e) {
        e.preventDefault();
        $('#connection-button').button('loading');

        var config = this.buildConfig();

        Client.testEmail(
            config,
            () => {
                this.setState({
                    sendEmailNotifications: config.EmailSettings.SendEmailNotifications,
                    serverError: null,
                    saveNeeded: true,
                    emailSuccess: true,
                    emailFail: null
                });
                $('#connection-button').button('reset');
            },
            (err) => {
                this.setState({
                    sendEmailNotifications: config.EmailSettings.SendEmailNotifications,
                    serverError: null,
                    saveNeeded: true,
                    emailSuccess: null,
                    emailFail: err.message + ' - ' + err.detailed_error
                });
                $('#connection-button').button('reset');
            }
        );
    }

    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        var config = this.buildConfig();

        Client.saveConfig(
            config,
            () => {
                AsyncClient.getConfig();
                this.setState({
                    sendEmailNotifications: config.EmailSettings.SendEmailNotifications,
                    serverError: null,
                    saveNeeded: false,
                    emailSuccess: null,
                    emailFail: null
                });
                $('#save-button').button('reset');
            },
            (err) => {
                this.setState({
                    sendEmailNotifications: config.EmailSettings.SendEmailNotifications,
                    serverError: err.message,
                    saveNeeded: true,
                    emailSuccess: null,
                    emailFail: null
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

        var emailSuccess = '';
        if (this.state.emailSuccess) {
            emailSuccess = (
                 <div className='alert alert-success'>
                    <i className='fa fa-check'></i>{formatMessage(messages.emailSuccess)}
                </div>
            );
        }

        var emailFail = '';
        if (this.state.emailFail) {
            emailSuccess = (
                 <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>{formatMessage(messages.emailFail) + this.state.emailFail}
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3>{formatMessage(messages.emailSettings)}</h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='allowSignUpWithEmail'
                        >
                            {formatMessage(messages.allowSignupTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignUpWithEmail'
                                    value='true'
                                    ref='allowSignUpWithEmail'
                                    defaultChecked={this.props.config.EmailSettings.EnableSignUpWithEmail}
                                    onChange={this.handleChange.bind(this, 'allowSignUpWithEmail_true')}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignUpWithEmail'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.EnableSignUpWithEmail}
                                    onChange={this.handleChange.bind(this, 'allowSignUpWithEmail_false')}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.allowSignupDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='sendEmailNotifications'
                        >
                            {formatMessage(messages.notificationsTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='sendEmailNotifications'
                                    value='true'
                                    ref='sendEmailNotifications'
                                    defaultChecked={this.props.config.EmailSettings.SendEmailNotifications}
                                    onChange={this.handleChange.bind(this, 'sendEmailNotifications_true')}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='sendEmailNotifications'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.SendEmailNotifications}
                                    onChange={this.handleChange.bind(this, 'sendEmailNotifications_false')}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.notificationsDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='requireEmailVerification'
                        >
                            {formatMessage(messages.requireVerificationTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='requireEmailVerification'
                                    value='true'
                                    ref='requireEmailVerification'
                                    defaultChecked={this.props.config.EmailSettings.RequireEmailVerification}
                                    onChange={this.handleChange.bind(this, 'requireEmailVerification_true')}
                                    disabled={!this.state.sendEmailNotifications}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='requireEmailVerification'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.RequireEmailVerification}
                                    onChange={this.handleChange.bind(this, 'requireEmailVerification_false')}
                                    disabled={!this.state.sendEmailNotifications}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.requireVerificationDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackName'
                        >
                            {formatMessage(messages.notificationDisplayTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='feedbackName'
                                ref='feedbackName'
                                placeholder={formatMessage(messages.notificationDisplayExample)}
                                defaultValue={this.props.config.EmailSettings.FeedbackName}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.notificationDisplayDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackEmail'
                        >
                            {formatMessage(messages.notificationEmailTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='email'
                                className='form-control'
                                id='feedbackEmail'
                                ref='feedbackEmail'
                                placeholder={formatMessage(messages.notificationEmailExample)}
                                defaultValue={this.props.config.EmailSettings.FeedbackEmail}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.notificationEmailDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPUsername'
                        >
                            {formatMessage(messages.smtpUsernameTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPUsername'
                                ref='SMTPUsername'
                                placeholder={formatMessage(messages.smtpUsernameExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPUsername}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.smtpUsernameDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPPassword'
                        >
                            {formatMessage(messages.smtpPasswordTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPPassword'
                                ref='SMTPPassword'
                                placeholder={formatMessage(messages.smtpPasswordExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPPassword}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.smtpPasswordDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPServer'
                        >
                            {formatMessage(messages.smtpServerTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPServer'
                                ref='SMTPServer'
                                placeholder={formatMessage(messages.smtpServerExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPServer}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.smtpServerDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPPort'
                        >
                            {formatMessage(messages.smtpPortTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPPort'
                                ref='SMTPPort'
                                placeholder={formatMessage(messages.smtpPortExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPPort}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.smtpPortDescription)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ConnectionSecurity'
                        >
                            {formatMessage(messages.connectionSecurityTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <select
                                className='form-control'
                                id='ConnectionSecurity'
                                ref='ConnectionSecurity'
                                defaultValue={this.props.config.EmailSettings.ConnectionSecurity}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            >
                                <option value=''>{formatMessage(messages.connectionSecurityNone)}</option>
                                <option value='TLS'>{formatMessage(messages.connectionSecurityTls)}</option>
                                <option value='STARTTLS'>{formatMessage(messages.connectionSecurityStart)}</option>
                            </select>
                            <div className='help-text'>
                                <table
                                    className='table table-bordered'
                                    cellPadding='5'
                                >
                                    <tbody>
                                        <tr><td className='help-text'>{formatMessage(messages.connectionSecurityNone)}</td><td className='help-text'>{formatMessage(messages.connectionSecurityNoneDescription)}</td></tr>
                                        <tr><td className='help-text'>{formatMessage(messages.connectionSecurityTls)}</td><td className='help-text'>{formatMessage(messages.connectionSecurityTlsDescription)}</td></tr>
                                        <tr><td className='help-text'>{formatMessage(messages.connectionSecurityStart)}</td><td className='help-text'>{formatMessage(messages.connectionSecurityStartDescription)}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleTestConnection}
                                    disabled={!this.state.sendEmailNotifications}
                                    id='connection-button'
                                    data-loading-text={`<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ${formatMessage(messages.testing)}`}
                                >
                                    {formatMessage(messages.connectionSecurityTest)}
                                </button>
                                {emailSuccess}
                                {emailFail}
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='InviteSalt'
                        >
                            {formatMessage(messages.inviteSaltTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='InviteSalt'
                                ref='InviteSalt'
                                placeholder={formatMessage(messages.inviteSaltExample)}
                                defaultValue={this.props.config.EmailSettings.InviteSalt}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.inviteSaltDescription)}</p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerateInvite}
                                    disabled={!this.state.sendEmailNotifications}
                                >
                                    {formatMessage(messages.regenerate)}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PasswordResetSalt'
                        >
                            {formatMessage(messages.passwordSaltTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PasswordResetSalt'
                                ref='PasswordResetSalt'
                                placeholder={formatMessage(messages.passwordSaltExample)}
                                defaultValue={this.props.config.EmailSettings.PasswordResetSalt}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.passwordSaltDescription)}</p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerateReset}
                                    disabled={!this.state.sendEmailNotifications}
                                >
                                    {formatMessage(messages.regenerate)}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='sendPushNotifications'
                        >
                            {formatMessage(messages.pushTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='sendPushNotifications'
                                    value='true'
                                    ref='sendPushNotifications'
                                    defaultChecked={this.props.config.EmailSettings.SendPushNotifications}
                                    onChange={this.handleChange.bind(this, 'sendPushNotifications_true')}
                                />
                                    {formatMessage(messages.true)}
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='sendPushNotifications'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.SendPushNotifications}
                                    onChange={this.handleChange.bind(this, 'sendPushNotifications_false')}
                                />
                                    {formatMessage(messages.false)}
                            </label>
                            <p className='help-text'>{formatMessage(messages.pushDesc)}</p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PushNotificationServer'
                        >
                            {formatMessage(messages.pushServerTitle)}
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PushNotificationServer'
                                ref='PushNotificationServer'
                                placeholder='E.g.: "https://push-test.mattermost.com"'
                                defaultValue={this.props.config.EmailSettings.PushNotificationServer}
                                onChange={this.handleChange}
                                disabled={!this.state.sendPushNotifications}
                            />
                            <p className='help-text'>{formatMessage(messages.pushServerDesc)}</p>
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

EmailSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(EmailSettings);