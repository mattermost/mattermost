// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';

import {injectIntl, intlShape, defineMessages, FormattedMessage, FormattedHTMLMessage} from 'mm-intl';

const DEFAULT_LDAP_PORT = 389;
const DEFAULT_QUERY_TIMEOUT = 60;

var holders = defineMessages({
    serverEx: {
        id: 'admin.ldap.serverEx',
        defaultMessage: 'Ex "10.0.0.23"'
    },
    portEx: {
        id: 'admin.ldap.portEx',
        defaultMessage: 'Ex "389"'
    },
    baseEx: {
        id: 'admin.ldap.baseEx',
        defaultMessage: 'Ex "ou=Unit Name,dc=corp,dc=example,dc=com"'
    },
    firstnameAttrEx: {
        id: 'admin.ldap.firstnameAttrEx',
        defaultMessage: 'Ex "givenName"'
    },
    lastnameAttrEx: {
        id: 'admin.ldap.lastnameAttrEx',
        defaultMessage: 'Ex "sn"'
    },
    emailAttrEx: {
        id: 'admin.ldap.emailAttrEx',
        defaultMessage: 'Ex "mail" or "userPrincipalName"'
    },
    usernameAttrEx: {
        id: 'admin.ldap.usernameAttrEx',
        defaultMessage: 'Ex "sAMAccountName"'
    },
    idAttrEx: {
        id: 'admin.ldap.idAttrEx',
        defaultMessage: 'Ex "sAMAccountName"'
    },
    queryEx: {
        id: 'admin.ldap.queryEx',
        defaultMessage: 'Ex "60"'
    },
    saving: {
        id: 'admin.ldap.saving',
        defaultMessage: 'Saving Config...'
    }
});

class LdapSettings extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleEnable = this.handleEnable.bind(this);
        this.handleDisable = this.handleDisable.bind(this);

        this.state = {
            saveNeeded: false,
            serverError: null,
            enable: this.props.config.LdapSettings.Enable
        };
    }
    handleChange() {
        this.setState({saveNeeded: true});
    }
    handleEnable() {
        this.setState({saveNeeded: true, enable: true});
    }
    handleDisable() {
        this.setState({saveNeeded: true, enable: false});
    }
    handleSubmit(e) {
        e.preventDefault();
        $('#save-button').button('loading');

        const config = this.props.config;
        config.LdapSettings.Enable = this.refs.Enable.checked;
        config.LdapSettings.LdapServer = this.refs.LdapServer.value.trim();

        let LdapPort = DEFAULT_LDAP_PORT;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.LdapPort).value, 10))) {
            LdapPort = parseInt(ReactDOM.findDOMNode(this.refs.LdapPort).value, 10);
        }
        config.LdapSettings.LdapPort = LdapPort;

        config.LdapSettings.BaseDN = this.refs.BaseDN.value.trim();
        config.LdapSettings.BindUsername = this.refs.BindUsername.value.trim();
        config.LdapSettings.BindPassword = this.refs.BindPassword.value.trim();
        config.LdapSettings.FirstNameAttribute = this.refs.FirstNameAttribute.value.trim();
        config.LdapSettings.LastNameAttribute = this.refs.LastNameAttribute.value.trim();
        config.LdapSettings.EmailAttribute = this.refs.EmailAttribute.value.trim();
        config.LdapSettings.UsernameAttribute = this.refs.UsernameAttribute.value.trim();
        config.LdapSettings.IdAttribute = this.refs.IdAttribute.value.trim();

        let QueryTimeout = DEFAULT_QUERY_TIMEOUT;
        if (!isNaN(parseInt(ReactDOM.findDOMNode(this.refs.QueryTimeout).value, 10))) {
            QueryTimeout = parseInt(ReactDOM.findDOMNode(this.refs.QueryTimeout).value, 10);
        }
        config.LdapSettings.QueryTimeout = QueryTimeout;

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
        let serverError = '';
        if (this.state.serverError) {
            serverError = <div className='form-group has-error'><label className='control-label'>{this.state.serverError}</label></div>;
        }

        let saveClass = 'btn';
        if (this.state.saveNeeded) {
            saveClass = 'btn btn-primary';
        }

        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true';

        let bannerContent;
        if (licenseEnabled) {
            bannerContent = (
                <div className='banner'>
                    <div className='banner__content'>
                        <h4 className='banner__heading'>
                            <FormattedMessage
                                id='admin.ldap.bannerHeading'
                                defaultMessage='Note:'
                            />
                        </h4>
                        <p>
                            <FormattedMessage
                                id='admin.ldap.bannerDesc'
                                defaultMessage='If a user attribute changes on the LDAP server it will be updated the next time the user enters their credentials to log in to Mattermost. This includes if a user is made inactive or removed from an LDAP server. Synchronization with LDAP servers is planned in a future release.'
                            />
                        </p>
                    </div>
                </div>
            );
        } else {
            bannerContent = (
                <div className='banner warning'>
                    <div className='banner__content'>
                        <FormattedHTMLMessage
                            id='admin.ldap.noLicense'
                            defaultMessage='<h4 class="banner__heading">Note:</h4><p>LDAP is an enterprise feature. Your current license does not support LDAP. Click <a href="http://mattermost.com"target="_blank">here</a> for information and pricing on enterprise licenses.</p>'
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className='wrapper--fixed'>
                {bannerContent}
                <h3>
                    <FormattedMessage
                        id='admin.ldap.title'
                        defaultMessage='LDAP Settings'
                    />
                </h3>
                <form
                    className='form-horizontal'
                    role='form'
                >
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='Enable'
                        >
                            <FormattedMessage
                                id='admin.ldap.enableTitle'
                                defaultMessage='Enable Login With LDAP:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='true'
                                    ref='Enable'
                                    defaultChecked={this.props.config.LdapSettings.Enable}
                                    onChange={this.handleEnable}
                                    disabled={!licenseEnabled}
                                />
                                <FormattedMessage
                                    id='admin.ldap.true'
                                    defaultMessage='true'
                                />
                            </label>
                            <label className='radio-inline'>
                                <input
                                    type='radio'
                                    name='Enable'
                                    value='false'
                                    defaultChecked={!this.props.config.LdapSettings.Enable}
                                    onChange={this.handleDisable}
                                />
                                <FormattedMessage
                                    id='admin.ldap.false'
                                    defaultMessage='false'
                                />
                            </label>
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.enableDesc'
                                    defaultMessage='When true, Mattermost allows login using LDAP'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LdapServer'
                        >
                            <FormattedMessage
                                id='admin.ldap.serverTitle'
                                defaultMessage='LDAP Server:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='LdapServer'
                                ref='LdapServer'
                                placeholder={formatMessage(holders.serverEx)}
                                defaultValue={this.props.config.LdapSettings.LdapServer}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.serverDesc'
                                    defaultMessage='The domain or IP address of LDAP server.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LdapPort'
                        >
                            <FormattedMessage
                                id='admin.ldap.portTitle'
                                defaultMessage='LDAP Port:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='number'
                                className='form-control'
                                id='LdapPort'
                                ref='LdapPort'
                                placeholder={formatMessage(holders.portEx)}
                                defaultValue={this.props.config.LdapSettings.LdapPort}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.portDesc'
                                    defaultMessage='The port Mattermost will use to connect to the LDAP server. Default is 389.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BaseDN'
                        >
                            <FormattedMessage
                                id='admin.ldap.baseTitle'
                                defaultMessage='BaseDN:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='BaseDN'
                                ref='BaseDN'
                                placeholder={formatMessage(holders.baseEx)}
                                defaultValue={this.props.config.LdapSettings.BaseDN}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.baseDesc'
                                    defaultMessage='The Base DN is the Distinguished Name of the location where Mattermost should start its search for users in the LDAP tree.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BindUsername'
                        >
                            <FormattedMessage
                                id='admin.ldap.bindUserTitle'
                                defaultMessage='Bind Username:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='BindUsername'
                                ref='BindUsername'
                                placeholder=''
                                defaultValue={this.props.config.LdapSettings.BindUsername}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.bindUserDesc'
                                    defaultMessage='The username used to perform the LDAP search. This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the LDAP tree specified in the BaseDN field.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='BindPassword'
                        >
                            <FormattedMessage
                                id='admin.ldap.bindPwdTitle'
                                defaultMessage='Bind Password:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='password'
                                className='form-control'
                                id='BindPassword'
                                ref='BindPassword'
                                placeholder=''
                                defaultValue={this.props.config.LdapSettings.BindPassword}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.bindPwdDesc'
                                    defaultMessage='Password of the user given in "Bind Username".'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='FirstNameAttribute'
                        >
                            <FormattedMessage
                                id='admin.ldap.firstnameAttrTitle'
                                defaultMessage='First Name Attrubute'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='FirstNameAttribute'
                                ref='FirstNameAttribute'
                                placeholder={formatMessage(holders.firstnameAttrEx)}
                                defaultValue={this.props.config.LdapSettings.FirstNameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.firstnameAttrDesc'
                                    defaultMessage='The attribute in the LDAP server that will be used to populate the first name of users in Mattermost.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='LastNameAttribute'
                        >
                            <FormattedMessage
                                id='admin.ldap.lastnameAttrTitle'
                                defaultMessage='Last Name Attribute:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='LastNameAttribute'
                                ref='LastNameAttribute'
                                placeholder={formatMessage(holders.lastnameAttrEx)}
                                defaultValue={this.props.config.LdapSettings.LastNameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.lastnameAttrDesc'
                                    defaultMessage='The attribute in the LDAP server that will be used to populate the last name of users in Mattermost.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='EmailAttribute'
                        >
                            <FormattedMessage
                                id='admin.ldap.emailAttrTitle'
                                defaultMessage='Email Attribute:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='EmailAttribute'
                                ref='EmailAttribute'
                                placeholder={formatMessage(holders.emailAttrEx)}
                                defaultValue={this.props.config.LdapSettings.EmailAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.emailAttrDesc'
                                    defaultMessage='The attribute in the LDAP server that will be used to populate the email addresses of users in Mattermost.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='UsernameAttribute'
                        >
                            <FormattedMessage
                                id='admin.ldap.usernameAttrTitle'
                                defaultMessage='Username Attribute:'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='UsernameAttribute'
                                ref='UsernameAttribute'
                                placeholder={formatMessage(holders.usernameAttrEx)}
                                defaultValue={this.props.config.LdapSettings.UsernameAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.uernameAttrDesc'
                                    defaultMessage='The attribute in the LDAP server that will be used to populate the username field in Mattermost. This may be the same as the ID Attribute.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='IdAttribute'
                        >
                            <FormattedMessage
                                id='admin.ldap.idAttrTitle'
                                defaultMessage='Id Attribute: '
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='text'
                                className='form-control'
                                id='IdAttribute'
                                ref='IdAttribute'
                                placeholder={formatMessage(holders.idAttrEx)}
                                defaultValue={this.props.config.LdapSettings.IdAttribute}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.idAttrDesc'
                                    defaultMessage='The attribute in the LDAP server that will be used as a unique identifier in Mattermost. It should be an LDAP attribute with a value that does not change, such as username or uid. If a user’s Id Attribute changes, it will create a new Mattermost account unassociated with their old one. This is the value used to log in to Mattermost in the "LDAP Username" field on the sign in page. Normally this attribute is the same as the “Username Attribute” field above. If your team typically uses domain\\username to sign in to other services with LDAP, you may choose to put domain\\username in this field to maintain consistency between sites.'
                                />
                            </p>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='QueryTimeout'
                        >
                            <FormattedMessage
                                id='admin.ldap.queryTitle'
                                defaultMessage='Query Timeout (seconds):'
                            />
                        </label>
                        <div className='col-sm-8'>
                            <input
                                type='number'
                                className='form-control'
                                id='QueryTimeout'
                                ref='QueryTimeout'
                                placeholder={formatMessage(holders.queryEx)}
                                defaultValue={this.props.config.LdapSettings.QueryTimeout}
                                onChange={this.handleChange}
                                disabled={!this.state.enable}
                            />
                            <p className='help-text'>
                                <FormattedMessage
                                    id='admin.ldap.queryDesc'
                                    defaultMessage='The timeout value for queries to the LDAP server. Increase if you are getting timeout errors caused by a slow LDAP server.'
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
                                    id='admin.ldap.save'
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
LdapSettings.defaultProps = {
};

LdapSettings.propTypes = {
    intl: intlShape.isRequired,
    config: React.PropTypes.object
};

export default injectIntl(LdapSettings);
