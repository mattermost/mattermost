// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import ConnectionSecurityDropdownSetting from './connection_security_dropdown_setting.jsx';
import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import TextSetting from './text_setting.jsx';

export class LdapSettingsPage extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.renderSettings = this.renderSettings.bind(this);

        this.state = Object.assign(this.state, {
            ldapServer: props.config.LdapSettings.LdapServer,
            ldapPort: props.config.LdapSettings.LdapPort,
            ldapConnectionSecurity: props.config.LdapSettings.ConnectionSecurity,
            ldapBaseDN: props.config.LdapSettings.BaseDN,
            ldapBindUsername: props.config.LdapSettings.BindUsername,
            ldapBindPassword: props.config.LdapSettings.BindPassword,
            ldapUserFilter: props.config.LdapSettings.UserFilter,
            ldapFirstNameAttribute: props.config.LdapSettings.FirstNameAttribute,
            ldapLastNameAttribute: props.config.LdapSettings.LastNameAttribute,
            ldapNicknameAttribute: props.config.LdapSettings.NicknameAttribute,
            ldapEmailAttribute: props.config.LdapSettings.EmailAttribute,
            ldapUsernameAttribute: props.config.LdapSettings.UsernameAttribute,
            ldapIdAttribute: props.config.LdapSettings.IdAttribute,
            ldapSkipCertificateVerification: props.config.LdapSettings.SkipCertificateVerification,
            ldapQueryTimeout: props.config.LdapSettings.QueryTimeout,
            ldapLoginFieldName: props.config.LdapSettings.LoginFieldName
        });
    }

    getConfigFromState(config) {
        config.LdapSettings.LdapServer = this.state.ldapServer;
        config.LdapSettings.LdapPort = this.state.ldapPort;
        config.LdapSettings.ConnectionSecurity = this.state.ldapConnectionSecurity;
        config.LdapSettings.BaseDN = this.state.ldapBaseDN;
        config.LdapSettings.BindUsername = this.state.ldapBindUsername;
        config.LdapSettings.BindPassword = this.state.ldapBindPassword;
        config.LdapSettings.UserFilter = this.state.ldapUserFilter;
        config.LdapSettings.FirstNameAttribute = this.state.ldapFirstNameAttribute;
        config.LdapSettings.LastNameAttribute = this.state.ldapLastNameAttribute;
        config.LdapSettings.NicknameAttribute = this.state.ldapNicknameAttribute;
        config.LdapSettings.EmailAttribute = this.state.ldapEmailAttribute;
        config.LdapSettings.UsernameAttribute = this.state.ldapUsernameAttribute;
        config.LdapSettings.IdAttribute = this.state.ldapIdAttribute;
        config.LdapSettings.SkipCertificateVerification = this.state.ldapSkipCertificateVerification;
        config.LdapSettings.QueryTimeout = this.state.ldapQueryTimeout;
        config.LdapSettings.LoginFieldName = this.state.ldapLoginFieldName;

        return config;
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.authentication.title'
                    defaultMessage='Authentication Settings'
                />
            </h3>
        );
    }

    renderSettings() {
        return (
            <LdapSettings
                enableSignUpWithLdap={this.props.config.LdapSettings.Enable}
                ldapServer={this.state.ldapServer}
                ldapPort={this.state.ldapPort}
                ldapConnectionSecurity={this.state.ldapConnectionSecurity}
                ldapBaseDN={this.state.ldapBaseDN}
                ldapBindUsername={this.state.ldapBindUsername}
                ldapBindPassword={this.state.ldapBindPassword}
                ldapUserFilter={this.state.ldapUserFilter}
                ldapFirstNameAttribute={this.state.ldapFirstNameAttribute}
                ldapLastNameAttribute={this.state.ldapLastNameAttribute}
                ldapNicknameAttribute={this.state.ldapNicknameAttribute}
                ldapEmailAttribute={this.state.ldapEmailAttribute}
                ldapUsernameAttribute={this.state.ldapUsernameAttribute}
                ldapIdAttribute={this.state.ldapIdAttribute}
                ldapSkipCertificateVerification={this.state.ldapSkipCertificateVerification}
                ldapQueryTimeout={this.state.ldapQueryTimeout}
                ldapLoginFieldName={this.state.ldapLoginFieldName}
                onChange={this.handleChange}
            />
        );
    }
}

export class LdapSettings extends React.Component {
    static get propTypes() {
        return {
            enableSignUpWithLdap: React.PropTypes.bool.isRequired,
            ldapServer: React.PropTypes.string.isRequired,
            ldapPort: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            ldapConnectionSecurity: React.PropTypes.string.isRequired,
            ldapBaseDN: React.PropTypes.string.isRequired,
            ldapBindUsername: React.PropTypes.string.isRequired,
            ldapBindPassword: React.PropTypes.string.isRequired,
            ldapUserFilter: React.PropTypes.string.isRequired,
            ldapFirstNameAttribute: React.PropTypes.string.isRequired,
            ldapLastNameAttribute: React.PropTypes.string.isRequired,
            ldapNicknameAttribute: React.PropTypes.string.isRequired,
            ldapEmailAttribute: React.PropTypes.string.isRequired,
            ldapUsernameAttribute: React.PropTypes.string.isRequired,
            ldapIdAttribute: React.PropTypes.string.isRequired,
            ldapSkipCertificateVerification: React.PropTypes.bool.isRequired,
            ldapQueryTimeout: React.PropTypes.oneOfType([
                React.PropTypes.string,
                React.PropTypes.number
            ]).isRequired,
            ldapLoginFieldName: React.PropTypes.string.isRequired,
            onChange: React.PropTypes.func.isRequired
        };
    }

    render() {
        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.LDAP === 'true';

        let bannerContent;
        if (licenseEnabled && this.props.enableSignUpWithLdap) {
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
        } else if (licenseEnabled) {
            bannerContent = (
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.authentication.ldap.disabled'
                            defaultMessage='LDAP settings cannot be changed while LDAP Sign Up is disabled.'
                        />
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
            <SettingsGroup
                header={
                    <FormattedMessage
                        id='admin.authentication.ldap'
                        defaultMessage='LDAP'
                    />

                }
            >
                {bannerContent}
                <TextSetting
                    id='ldapServer'
                    label={
                        <FormattedMessage
                            id='admin.ldap.serverTitle'
                            defaultMessage='LDAP Server:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.serverEx', 'Ex "10.0.0.23"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.serverDesc'
                            defaultMessage='The domain or IP address of LDAP server.'
                        />
                    }
                    value={this.props.ldapServer}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapPort'
                    label={
                        <FormattedMessage
                            id='admin.ldap.portTitle'
                            defaultMessage='LDAP Port:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.portEx', 'Ex "389"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.portDesc'
                            defaultMessage='The port Mattermost will use to connect to the LDAP server. Default is 389.'
                        />
                    }
                    value={this.props.ldapPort}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <ConnectionSecurityDropdownSetting
                    value={this.props.ldapConnectionSecurity}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapBaseDN'
                    label={
                        <FormattedMessage
                            id='admin.ldap.baseTitle'
                            defaultMessage='BaseDN:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.baseEx', 'Ex "ou=Unit Name,dc=corp,dc=example,dc=com"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.baseDesc'
                            defaultMessage='The Base DN is the Distinguished Name of the location where Mattermost should start its search for users in the LDAP tree.'
                        />
                    }
                    value={this.props.ldapBaseDN}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapBindUsername'
                    label={
                        <FormattedMessage
                            id='admin.ldap.bindUserTitle'
                            defaultMessage='Bind Username:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.bindUserDesc'
                            defaultMessage='The username used to perform the LDAP search. This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the LDAP tree specified in the BaseDN field.'
                        />
                    }
                    value={this.props.ldapBindUsername}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapBindPassword'
                    label={
                        <FormattedMessage
                            id='admin.ldap.bindPwdTitle'
                            defaultMessage='Bind Password:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.bindPwdDesc'
                            defaultMessage='Password of the user given in "Bind Username".'
                        />
                    }
                    value={this.props.ldapBindPassword}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapUserFilter'
                    label={
                        <FormattedMessage
                            id='admin.ldap.userFilterTitle'
                            defaultMessage='User Filter:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.userFilterEx', 'Ex. "(objectClass=user)"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.userFilterDisc'
                            defaultMessage='Optionally enter an LDAP Filter to use when searching for user objects. Only the users selected by the query will be able to access Mattermost. For Active Directory, the query to filter out disabled users is (&(objectCategory=Person)(!(UserAccountControl:1.2.840.113556.1.4.803:=2))).'
                        />
                    }
                    value={this.props.ldapUserFilter}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapFirstNameAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.firstnameAttrTitle'
                            defaultMessage='First Name Attrubute'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.firstnameAttrEx', 'Ex "givenName"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.firstnameAttrDesc'
                            defaultMessage='The attribute in the LDAP server that will be used to populate the first name of users in Mattermost.'
                        />
                    }
                    value={this.props.ldapFirstNameAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapLastNameAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.lastnameAttrTitle'
                            defaultMessage='Last Name Attribute:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.lastnameAttrEx', 'Ex "sn"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.lastnameAttrDesc'
                            defaultMessage='The attribute in the LDAP server that will be used to populate the last name of users in Mattermost.'
                        />
                    }
                    value={this.props.ldapLastNameAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapNicknameAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.nicknameAttrTitle'
                            defaultMessage='Nickname Attribute:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.nicknameAttrEx', 'Ex "nickname"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.nicknameAttrDesc'
                            defaultMessage='(Optional) The attribute in the LDAP server that will be used to populate the nickname of users in Mattermost.'
                        />
                    }
                    value={this.props.ldapNicknameAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapEmailAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.emailAttrTitle'
                            defaultMessage='Email Attribute:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.emailAttrEx', 'Ex "mail" or "userPrincipalName"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.emailAttrDesc'
                            defaultMessage='The attribute in the LDAP server that will be used to populate the email addresses of users in Mattermost.'
                        />
                    }
                    value={this.props.ldapEmailAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapUsernameAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.usernameAttrTitle'
                            defaultMessage='Username Attribute:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.usernameAttrEx', 'Ex "sAMAccountName"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.uernameAttrDesc'
                            defaultMessage='The attribute in the LDAP server that will be used to populate the username field in Mattermost. This may be the same as the ID Attribute.'
                        />
                    }
                    value={this.props.ldapUsernameAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapIdAttribute'
                    label={
                        <FormattedMessage
                            id='admin.ldap.idAttrTitle'
                            defaultMessage='Id Attribute: '
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.idAttrEx', 'Ex "sAMAccountName"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.idAttrDesc'
                            defaultMessage='The attribute in the LDAP server that will be used as a unique identifier in Mattermost. It should be an LDAP attribute with a value that does not change, such as username or uid. If a user’s Id Attribute changes, it will create a new Mattermost account unassociated with their old one. This is the value used to log in to Mattermost in the "LDAP Username" field on the sign in page. Normally this attribute is the same as the “Username Attribute” field above. If your team typically uses domain\\username to sign in to other services with LDAP, you may choose to put domain\\username in this field to maintain consistency between sites.'
                        />
                    }
                    value={this.props.ldapIdAttribute}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <BooleanSetting
                    id='ldapSkipCertificateVerification'
                    label={
                        <FormattedMessage
                            id='admin.ldap.skipCertificateVerification'
                            defaultMessage='Skip Certificate Verification'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.skipCertificateVerificationDesc'
                            defaultMessage='Skips the certificate verification step for TLS or STARTTLS connections. Not recommended for production environments where TLS is required. For testing only.'
                        />
                    }
                    value={this.props.ldapSkipCertificateVerification}
                    onChange={this.props.onChange}
                />
                <TextSetting
                    id='ldapQueryTimeout'
                    label={
                        <FormattedMessage
                            id='admin.ldap.queryTitle'
                            defaultMessage='Query Timeout (seconds):'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.queryEx', 'Ex "60"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.queryDesc'
                            defaultMessage='The timeout value for queries to the LDAP server. Increase if you are getting timeout errors caused by a slow LDAP server.'
                        />
                    }
                    value={this.props.ldapQueryTimeout}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
                <TextSetting
                    id='ldapLoginFieldName'
                    label={
                        <FormattedMessage
                            id='admin.ldap.loginNameTitle'
                            defaultMessage='Login Field Name:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.ldap.loginNameEx', 'Ex "LDAP Username"')}
                    helpText={
                        <FormattedMessage
                            id='admin.ldap.loginNameDesc'
                            defaultMessage='The placeholder text that appears in the login field on the login page. Defaults to "LDAP Username".'
                        />
                    }
                    value={this.props.ldapLoginFieldName}
                    onChange={this.props.onChange}
                    disabled={!this.props.enableSignUpWithLdap}
                />
            </SettingsGroup>
        );
    }
}
