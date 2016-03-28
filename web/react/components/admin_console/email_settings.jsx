// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import Constants from '../../utils/constants.jsx';
import crypto from 'crypto';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

var holders = defineMessages({
    notificationDisplayExample: {
        id: 'admin.email.notificationDisplayExample',
        defaultMessage: 'Ex: "Mattermost Notification", "System", "No-Reply"'
    },
    notificationEmailExample: {
        id: 'admin.email.notificationEmailExample',
        defaultMessage: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"'
    },
    smtpUsernameExample: {
        id: 'admin.email.smtpUsernameExample',
        defaultMessage: 'Ex: "admin@yourcompany.com", "AKIADTOVBGERKLCBV"'
    },
    smtpPasswordExample: {
        id: 'admin.email.smtpPasswordExample',
        defaultMessage: 'Ex: "yourpassword", "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'
    },
    smtpServerExample: {
        id: 'admin.email.smtpServerExample',
        defaultMessage: 'Ex: "smtp.yourcompany.com", "email-smtp.us-east-1.amazonaws.com"'
    },
    smtpPortExample: {
        id: 'admin.email.smtpPortExample',
        defaultMessage: 'Ex: "25", "465"'
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
    inviteSaltExample: {
        id: 'admin.email.inviteSaltExample',
        defaultMessage: 'Ex "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9Yo"'
    },
    passwordSaltExample: {
        id: 'admin.email.passwordSaltExample',
        defaultMessage: 'Ex "bjlSR4QqkXFBr7TP4oDzlfZmcNuH9Yo"'
    },
    pushServerEx: {
        id: 'admin.email.pushServerEx',
        defaultMessage: 'E.g.: "http://push-test.mattermost.com"'
    },
    testing: {
        id: 'admin.email.testing',
        defaultMessage: 'Testing...'
    },
    saving: {
        id: 'admin.email.saving',
        defaultMessage: 'Saving Config...'
    },
    pushOff: {
        id: 'admin.email.pushOff',
        defaultMessage: 'Do not send push notifications'
    },
    mtpns: {
        id: 'admin.email.mtpns',
        defaultMessage: 'Use iOS and Android apps on iTunes and Google Play with TPNS connection'
    },
    mhpns: {
        id: 'admin.email.mhpns',
        defaultMessage: 'Use encrypted, production-quality HPNS connection to iOS and Android devices on iTunes and Google Play'
    },
    selfPush: {
        id: 'admin.email.selfPush',
        defaultMessage: 'Manually enter Push Notification Service location'
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
        this.handleSendPushNotificationsChange = this.handleSendPushNotificationsChange.bind(this);
        this.handlePushServerChange = this.handlePushServerChange.bind(this);
        this.handleAgreeChange = this.handleAgreeChange.bind(this);

        let sendNotificationValue;
        let agree = false;
        if (!props.config.EmailSettings.SendPushNotifications) {
            sendNotificationValue = 'off';
        } else if (props.config.EmailSettings.PushNotificationServer === Constants.MHPNS && global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MHPNS === 'true') {
            sendNotificationValue = 'mhpns';
            agree = true;
        } else if (props.config.EmailSettings.PushNotificationServer === Constants.MTPNS) {
            sendNotificationValue = 'mtpns';
        } else {
            sendNotificationValue = 'self';
        }

        let pushNotificationServer = this.props.config.EmailSettings.PushNotificationServer;
        if (sendNotificationValue === 'mtpns') {
            pushNotificationServer = Constants.MTPNS;
        } else if (sendNotificationValue === 'mhpns') {
            pushNotificationServer = Constants.MHPNS;
        }

        this.state = {
            sendEmailNotifications: this.props.config.EmailSettings.SendEmailNotifications,
            saveNeeded: false,
            serverError: null,
            emailSuccess: null,
            emailFail: null,
            sendNotificationValue,
            pushNotificationServer,
            agree
        };
    }

    handleChange(action) {
        var s = {saveNeeded: true};

        if (action === 'sendEmailNotifications_true') {
            s.sendEmailNotifications = true;
        }

        if (action === 'sendEmailNotifications_false') {
            s.sendEmailNotifications = false;
        }

        this.setState(s);
    }

    buildConfig() {
        var config = this.props.config;
        config.EmailSettings.EnableSignUpWithEmail = ReactDOM.findDOMNode(this.refs.allowSignUpWithEmail).checked;
        config.EmailSettings.EnableSignInWithEmail = ReactDOM.findDOMNode(this.refs.allowSignInWithEmail).checked;
        config.EmailSettings.EnableSignInWithUsername = ReactDOM.findDOMNode(this.refs.allowSignInWithUsername).checked;
        config.EmailSettings.SendEmailNotifications = ReactDOM.findDOMNode(this.refs.sendEmailNotifications).checked;
        config.EmailSettings.RequireEmailVerification = ReactDOM.findDOMNode(this.refs.requireEmailVerification).checked;
        config.EmailSettings.FeedbackName = ReactDOM.findDOMNode(this.refs.feedbackName).value.trim();
        config.EmailSettings.FeedbackEmail = ReactDOM.findDOMNode(this.refs.feedbackEmail).value.trim();
        config.EmailSettings.SMTPServer = ReactDOM.findDOMNode(this.refs.SMTPServer).value.trim();
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

        const sendPushNotifications = ReactDOM.findDOMNode(this.refs.sendPushNotifications).value;
        if (sendPushNotifications === 'off') {
            config.EmailSettings.SendPushNotifications = false;
        } else {
            config.EmailSettings.SendPushNotifications = true;
        }

        if (this.refs.PushNotificationServer) {
            config.EmailSettings.PushNotificationServer = ReactDOM.findDOMNode(this.refs.PushNotificationServer).value.trim();
        }

        return config;
    }

    handleSendPushNotificationsChange(e) {
        const sendNotificationValue = e.target.value;
        let pushNotificationServer = this.state.pushNotificationServer;
        if (sendNotificationValue === 'mtpns') {
            pushNotificationServer = Constants.MTPNS;
        } else if (sendNotificationValue === 'mhpns') {
            pushNotificationServer = Constants.MHPNS;
        }
        this.setState({saveNeeded: true, sendNotificationValue, pushNotificationServer, agree: false});
    }

    handlePushServerChange(e) {
        this.setState({saveNeeded: true, pushNotificationServer: e.target.value});
    }

    handleAgreeChange(e) {
        this.setState({agree: e.target.checked});
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
                    <i className='fa fa-check'></i>
                     <FormattedMessage
                         id='admin.email.emailSuccess'
                         defaultMessage='No errors were reported while sending an email.  Please check your inbox to make sure.'
                     />
                </div>
            );
        }

        var emailFail = '';
        if (this.state.emailFail) {
            emailSuccess = (
                 <div className='alert alert-warning'>
                    <i className='fa fa-warning'></i>
                     <FormattedMessage
                         id='admin.email.emailFail'
                         defaultMessage='Connection unsuccessful: {error}'
                         values={{
                             error: this.state.emailFail
                         }}
                     />
                </div>
            );
        }

        let mhpnsOption;
        if (global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.MHPNS === 'true') {
            mhpnsOption = <option value='mhpns'>{formatMessage(holders.mhpns)}</option>;
        }

        let disableSave = !this.state.saveNeeded;

        let tosCheckbox;
        if (this.state.sendNotificationValue === 'mhpns') {
            tosCheckbox = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                    >
                        {''}
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='checkbox'
                            ref='agree'
                            checked={this.state.agree}
                            onChange={this.handleAgreeChange}
                        >
                            <FormattedHTMLMessage
                                id='admin.email.agreeHPNS'
                                defaultMessage=' I understand and accept the Mattermost Hosted Push Notification Service <a href="https://about.mattermost.com/hpns-terms/" target="_blank">Terms of Service</a> and <a href="https://about.mattermost.com/hpns-privacy/" target="_blank">Privacy Policy</a>.'
                            />
                        </input>
                    </div>
                </div>
            );

            disableSave = disableSave || !this.state.agree;
        }

        let sendHelpText;
        let pushServerHelpText;
        if (this.state.sendNotificationValue === 'off') {
            sendHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.pushOffHelp'
                    defaultMessage='Please see <a href="http://docs.mattermost.com/deployment/push.html#push-notifications-and-mobile-devices" target="_blank">documentation on push notifications</a> to learn more about setup options.'
                />
            );
        } else if (this.state.sendNotificationValue === 'mhpns') {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.mhpnsHelp'
                    defaultMessage='Download <a href="https://itunes.apple.com/us/app/mattermost/id984966508?mt=8" target="_blank">Mattermost iOS app</a> from iTunes. Download <a href="https://play.google.com/store/apps/details?id=com.mattermost.mattermost&hl=en" target="_blank">Mattermost Android app</a> from Google Play. Learn more about the <a href="http://docs.mattermost.com/deployment/push.html#hosted-push-notifications-service-hpns" target="_blank">Mattermost Hosted Push Notification Service</a>.'
                />
            );
        } else if (this.state.sendNotificationValue === 'mtpns') {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.mtpnsHelp'
                    defaultMessage='Download <a href="https://itunes.apple.com/us/app/mattermost/id984966508?mt=8" target="_blank">Mattermost iOS app</a> from iTunes. Download <a href="https://play.google.com/store/apps/details?id=com.mattermost.mattermost&hl=en" target="_blank">Mattermost Android app</a> from Google Play. Learn more about the <a href="http://docs.mattermost.com/deployment/push.html#test-push-notifications-service-tpns" target="_blank">Mattermost Test Push Notification Service</a>.'
                />
            );
        } else {
            pushServerHelpText = (
                <FormattedHTMLMessage
                    id='admin.email.mtpnsHelp'
                    defaultMessage='Learn more about compiling and deploying your own mobile apps from an <a href="http://docs.mattermost.com/deployment/push.html#enterprise-app-store-eas" target="_blank">Enterprise App Store</a>.'
                />
            );
        }

        const sendPushNotifications = (
            <div className='form-group'>
                <label
                    className='control-label col-sm-4'
                    htmlFor='sendPushNotifications'
                >
                    <FormattedMessage
                        id='admin.email.pushTitle'
                        defaultMessage='Send Push Notifications: '
                    />
                </label>
                <div className='col-sm-8'>
                    <select
                        className='form-control'
                        id='sendPushNotifications'
                        ref='sendPushNotifications'
                        value={this.state.sendNotificationValue}
                        onChange={this.handleSendPushNotificationsChange}
                    >
                        <option value='off'>{formatMessage(holders.pushOff)}</option>
                        {mhpnsOption}
                        <option value='mtpns'>{formatMessage(holders.mtpns)}</option>
                        <option value='self'>{formatMessage(holders.selfPush)}</option>
                    </select>
                    <p className='help-text'>
                        {sendHelpText}
                    </p>
                </div>
            </div>
        );

        let pushNotificationServer;
        if (this.state.sendNotificationValue !== 'off') {
            pushNotificationServer = (
                <div className='form-group'>
                    <label
                        className='control-label col-sm-4'
                        htmlFor='PushNotificationServer'
                    >
                        <FormattedMessage
                            id='admin.email.pushServerTitle'
                            defaultMessage='Push Notification Server:'
                        />
                    </label>
                    <div className='col-sm-8'>
                        <input
                            type='text'
                            className='form-control'
                            id='PushNotificationServer'
                            ref='PushNotificationServer'
                            placeholder={formatMessage(holders.pushServerEx)}
                            value={this.state.pushNotificationServer}
                            onChange={this.handlePushServerChange}
                            disabled={this.state.sendNotificationValue !== 'self'}
                        />
                        <p className='help-text'>
                            {pushServerHelpText}
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                <h3>
                    <FormattedMessage
                        id='admin.email.emailSettings'
                        defaultMessage='Email Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='allowSignUpWithEmail'
                        >
                            <FormattedMessage
                                id='admin.email.allowSignupTitle'
                                defaultMessage='Allow Sign Up With Email: '
                            />
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
                                    <FormattedMessage
                                        id='admin.email.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignUpWithEmail'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.EnableSignUpWithEmail}
                                    onChange={this.handleChange.bind(this, 'allowSignUpWithEmail_false')}
                                />
                                    <FormattedMessage
                                        id='admin.email.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.allowSignupDescription'
                                    defaultMessage='When true, Mattermost allows team creation and account signup using email and password.  This value should be false only when you want to limit signup to a single-sign-on service like OAuth or LDAP.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='allowSignInWithEmail'
                        >
                            <FormattedMessage
                                id='admin.email.allowEmailSignInTitle'
                                defaultMessage='Allow Sign In With Email: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignInWithEmail'
                                    value='true'
                                    ref='allowSignInWithEmail'
                                    defaultChecked={this.props.config.EmailSettings.EnableSignInWithEmail}
                                    onChange={this.handleChange.bind(this, 'allowSignInWithEmail_true')}
                                />
                                <FormattedMessage
                                    id='admin.email.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignInWithEmail'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.EnableSignInWithEmail}
                                    onChange={this.handleChange.bind(this, 'allowSignInWithEmail_false')}
                                />
                                <FormattedMessage
                                    id='admin.email.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.allowEmailSignInDescription'
                                    defaultMessage='When true, Mattermost allows users to sign in using their email and password.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='allowSignInWithUsername'
                        >
                            <FormattedMessage
                                id='admin.email.allowUsernameSignInTitle'
                                defaultMessage='Allow Sign In With Username: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignInWithUsername'
                                    value='true'
                                    ref='allowSignInWithUsername'
                                    defaultChecked={this.props.config.EmailSettings.EnableSignInWithUsername}
                                    onChange={this.handleChange.bind(this, 'allowSignInWithUsername_true')}
                                />
                                <FormattedMessage
                                    id='admin.email.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='allowSignInWithUsername'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.EnableSignInWithUsername}
                                    onChange={this.handleChange.bind(this, 'allowSignInWithUsername_false')}
                                />
                                <FormattedMessage
                                    id='admin.email.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.allowUsernameSignInDescription'
                                    defaultMessage='When true, Mattermost allows users to sign in using their username and password.  This setting is typically only used when email verification is disabled.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='sendEmailNotifications'
                        >
                            <FormattedMessage
                                id='admin.email.notificationsTitle'
                                defaultMessage='Send Email Notifications: '
                            />
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
                                    <FormattedMessage
                                        id='admin.email.true'
                                        defaultMessage='true'
                                    />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='sendEmailNotifications'
                                    value='false'
                                    defaultChecked={!this.props.config.EmailSettings.SendEmailNotifications}
                                    onChange={this.handleChange.bind(this, 'sendEmailNotifications_false')}
                                />
                                    <FormattedMessage
                                        id='admin.email.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedHTMLMessage
                                    id='admin.email.notificationsDescription'
                                    defaultMessage='Typically set to true in production. When true, Mattermost attempts to send email notifications. Developers may set this field to false to skip email setup for faster development.<br />Setting this to true removes the Preview Mode banner (requires logging out and logging back in after setting is changed).'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='requireEmailVerification'
                        >
                            <FormattedMessage
                                id='admin.email.requireVerificationTitle'
                                defaultMessage='Require Email Verification: '
                            />
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
                                    <FormattedMessage
                                        id='admin.email.true'
                                        defaultMessage='true'
                                    />
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
                                    <FormattedMessage
                                        id='admin.email.false'
                                        defaultMessage='false'
                                    />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.requireVerificationDescription'
                                    defaultMessage='Typically set to true in production. When true, Mattermost requires email verification after account creation prior to allowing login. Developers may set this field to false so skip sending verification emails for faster development.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackName'
                        >
                            <FormattedMessage
                                id='admin.email.notificationDisplayTitle'
                                defaultMessage='Notification Display Name:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='feedbackName'
                                ref='feedbackName'
                                placeholder={formatMessage(holders.notificationDisplayExample)}
                                defaultValue={this.props.config.EmailSettings.FeedbackName}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.notificationDisplayDescription'
                                    defaultMessage='Display name on email account used when sending notification emails from Mattermost.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='feedbackEmail'
                        >
                            <FormattedMessage
                                id='admin.email.notificationEmailTitle'
                                defaultMessage='Notification Email Address:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='email'
                                className='form-control'
                                id='feedbackEmail'
                                ref='feedbackEmail'
                                placeholder={formatMessage(holders.notificationEmailExample)}
                                defaultValue={this.props.config.EmailSettings.FeedbackEmail}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.notificationEmailDescription'
                                    defaultMessage='Email address displayed on email account used when sending notification emails from Mattermost.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPUsername'
                        >
                            <FormattedMessage
                                id='admin.email.smtpUsernameTitle'
                                defaultMessage='SMTP Username:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPUsername'
                                ref='SMTPUsername'
                                placeholder={formatMessage(holders.smtpUsernameExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPUsername}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.smtpUsernameDescription'
                                    defaultMessage=' Obtain this credential from administrator setting up your email server.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPPassword'
                        >
                            <FormattedMessage
                                id='admin.email.smtpPasswordTitle'
                                defaultMessage='SMTP Password:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPPassword'
                                ref='SMTPPassword'
                                placeholder={formatMessage(holders.smtpPasswordExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPPassword}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.smtpPasswordDescription'
                                    defaultMessage=' Obtain this credential from administrator setting up your email server.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPServer'
                        >
                            <FormattedMessage
                                id='admin.email.smtpServerTitle'
                                defaultMessage='SMTP Server:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPServer'
                                ref='SMTPServer'
                                placeholder={formatMessage(holders.smtpServerExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPServer}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.smtpServerDescription'
                                    defaultMessage='Location of SMTP email server.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='SMTPPort'
                        >
                            <FormattedMessage
                                id='admin.email.smtpPortTitle'
                                defaultMessage='SMTP Port:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='SMTPPort'
                                ref='SMTPPort'
                                placeholder={formatMessage(holders.smtpPortExample)}
                                defaultValue={this.props.config.EmailSettings.SMTPPort}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.smtpPortDescription'
                                    defaultMessage='Port of SMTP email server.'
                                />
                            </p>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='ConnectionSecurity'
                        >
                            <FormattedMessage
                                id='admin.email.connectionSecurityTitle'
                                defaultMessage='Connection Security:'
                            />
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
                                <option value=''>{formatMessage(holders.connectionSecurityNone)}</option>
                                <option value='TLS'>{formatMessage(holders.connectionSecurityTls)}</option>
                                <option value='STARTTLS'>{formatMessage(holders.connectionSecurityStart)}</option>
                            </select>
                            <div className='help-text'>
                                <table
                                    className='table table-bordered'
                                    cellPadding='5'
                                >
                                    <tbody>
                                        <tr><td className='help-text'>
                                            <FormattedMessage
                                                id='admin.email.connectionSecurityNone'
                                                defaultMessage='None'
                                            />
                                        </td><td className='help-text'>
                                            <FormattedMessage
                                                id='admin.email.connectionSecurityNoneDescription'
                                                defaultMessage='Mattermost will send email over an unsecure connection.'
                                            />
                                        </td></tr>
                                        <tr><td className='help-text'>{'TLS'}</td><td className='help-text'>
                                            <FormattedMessage
                                                id='admin.email.connectionSecurityTlsDescription'
                                                defaultMessage='Encrypts the communication between Mattermost and your email server.'
                                            />
                                        </td></tr>
                                        <tr><td className='help-text'>{'STARTTLS'}</td><td className='help-text'>
                                            <FormattedMessage
                                                id='admin.email.connectionSecurityStartDescription'
                                                defaultMessage='Takes an existing insecure connection and attempts to upgrade it to a secure connection using TLS.'
                                            />
                                        </td></tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleTestConnection}
                                    disabled={!this.state.sendEmailNotifications}
                                    id='connection-button'
                                    data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.testing)}
                                >
                                    <FormattedMessage
                                        id='admin.email.connectionSecurityTest'
                                        defaultMessage='Test Connection'
                                    />
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
                            <FormattedMessage
                                id='admin.email.inviteSaltTitle'
                                defaultMessage='Invite Salt:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='InviteSalt'
                                ref='InviteSalt'
                                placeholder={formatMessage(holders.inviteSaltExample)}
                                defaultValue={this.props.config.EmailSettings.InviteSalt}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.inviteSaltDescription'
                                    defaultMessage='32-character salt added to signing of email invites. Randomly generated on install. Click "Re-Generate" to create new salt.'
                                />
                            </p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerateInvite}
                                    disabled={!this.state.sendEmailNotifications}
                                >
                                    <FormattedMessage
                                        id='admin.email.regenerate'
                                        defaultMessage='Re-Generate'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='PasswordResetSalt'
                        >
                            <FormattedMessage
                                id='admin.email.passwordSaltTitle'
                                defaultMessage='Password Reset Salt:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='PasswordResetSalt'
                                ref='PasswordResetSalt'
                                placeholder={formatMessage(holders.passwordSaltExample)}
                                defaultValue={this.props.config.EmailSettings.PasswordResetSalt}
                                onChange={this.handleChange}
                                disabled={!this.state.sendEmailNotifications}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.email.passwordSaltDescription'
                                    defaultMessage='32-character salt added to signing of password reset emails. Randomly generated on install. Click "Re-Generate" to create new salt.'
                                />
                            </p>
                            <div className='help-text'>
                                <button
                                    className='btn btn-default'
                                    onClick={this.handleGenerateReset}
                                    disabled={!this.state.sendEmailNotifications}
                                >
                                    <FormattedMessage
                                        id='admin.email.regenerate'
                                        defaultMessage='Re-Generate'
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {sendPushNotifications}
                    {tosCheckbox}
                    {pushNotificationServer}

                    <div className='form-group'>
                        <div className='col-sm-12'>
                            {serverError}
                            <button
                                disabled={disableSave}
                                type='submit'
                                className={saveClass}
                                onClick={this.handleSubmit}
                                id='save-button'
                                data-loading-text={'<span class=\'glyphicon glyphicon-refresh glyphicon-refresh-animate\'></span> ' + formatMessage(holders.saving)}
                            >
                                <FormattedMessage
                                    id='admin.email.save'
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

EmailSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(EmailSettings);
