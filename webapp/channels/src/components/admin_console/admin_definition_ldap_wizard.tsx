// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import type {Job} from '@mattermost/types/jobs';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {
    ldapTestAttributes,
    ldapTestConnection,
    ldapTestFilters,
    ldapTestGroupAttributes,
    removePrivateLdapCertificate,
    removePublicLdapCertificate,
    uploadPrivateLdapCertificate,
    uploadPublicLdapCertificate,
} from 'actions/admin_actions';

import ExternalLink from 'components/external_link';

import Constants, {DocLinks, LicenseSkus} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import * as DefinitionConstants from './admin_definition_constants';
import {it} from './admin_definition_helpers';
import CustomProfileAttributes from './custom_profile_attributes/custom_profile_attributes';
import type {LDAPAdminDefinitionConfigSchemaSettings} from './ldap_wizard/ldap_wizard';

const ASTERISK_PASSWORD_PATTERN = /^\*+$/;

export const ldapWizardAdminDefinition: LDAPAdminDefinitionConfigSchemaSettings = {
    id: 'LdapSettings',
    name: defineMessage({id: 'admin.authentication.ldap.wizard', defaultMessage: 'AD/LDAP Wizard'}),
    sections: [{
        key: 'admin.authentication.ldap.connection',
        title: 'Connection Settings',
        subtitle: 'Connection and security level to your AD/LDAP server.',
        settings: [
            {
                type: 'bool',
                key: 'LdapSettings.Enable',
                label: defineMessage({id: 'admin.ldap.enableTitle', defaultMessage: 'Enable sign-in with AD/LDAP:'}),
                help_text: defineMessage({id: 'admin.ldap.enableDesc', defaultMessage: 'When true, Mattermost allows login using AD/LDAP'}),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
            },
            {
                type: 'bool',
                key: 'LdapSettings.EnableSync',
                label: defineMessage({id: 'admin.ldap.enableSyncTitle', defaultMessage: 'Enable Synchronization with AD/LDAP:'}),
                help_text: defineMessage({id: 'admin.ldap.enableSyncDesc', defaultMessage: 'When true, Mattermost periodically synchronizes users from AD/LDAP. When false, user attributes are updated from AD/LDAP during user login only.'}),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
            },
            {
                type: 'text',
                key: 'LdapSettings.LoginFieldName',
                label: defineMessage({id: 'admin.ldap.loginNameTitle', defaultMessage: 'Login Field Name:'}),
                placeholder: defineMessage({id: 'admin.ldap.loginNameEx', defaultMessage: 'E.g.: "AD/LDAP Username"'}),
                help_text: defineMessage({id: 'admin.ldap.loginNameDesc', defaultMessage: 'The placeholder text that appears in the login field on the login page. Defaults to "AD/LDAP Username".'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.LdapServer',
                label: defineMessage({id: 'admin.ldap.serverTitle', defaultMessage: 'AD/LDAP Server:'}),
                help_text: defineMessage({id: 'admin.ldap.serverDesc', defaultMessage: 'The domain or IP address of AD/LDAP server.'}),
                placeholder: defineMessage({id: 'admin.ldap.serverEx', defaultMessage: 'E.g.: "10.0.0.23"'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'number',
                key: 'LdapSettings.LdapPort',
                label: defineMessage({id: 'admin.ldap.portTitle', defaultMessage: 'AD/LDAP Port:'}),
                help_text: defineMessage({id: 'admin.ldap.portDesc', defaultMessage: 'The port Mattermost will use to connect to the AD/LDAP server. Default is 389.'}),
                placeholder: defineMessage({id: 'admin.ldap.portEx', defaultMessage: 'E.g.: "389"'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.BindUsername',
                label: defineMessage({id: 'admin.ldap.bindUserTitle', defaultMessage: 'Bind Username:'}),
                help_text: defineMessage({id: 'admin.ldap.bindUserDesc', defaultMessage: 'The username used to perform the AD/LDAP search.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.bindUserDescHover', defaultMessage: 'This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the AD/LDAP tree specified in the Base DN field.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.BindPassword',
                label: defineMessage({id: 'admin.ldap.bindPwdTitle', defaultMessage: 'Bind Password:'}),
                help_text: defineMessage({id: 'admin.ldap.bindPwdDesc', defaultMessage: 'Password of the user given in "Bind Username".'}),
                onConfigSave: (value: string) => {
                    // If the password is just asterisks (placeholder from server), don't send it
                    if (typeof value === 'string' && ASTERISK_PASSWORD_PATTERN.test(value)) {
                        return undefined;
                    }
                    return value;
                },
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'dropdown',
                key: 'LdapSettings.ConnectionSecurity',
                label: defineMessage({id: 'admin.connectionSecurityTitle', defaultMessage: 'Connection Security:'}),
                help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_LDAP,
                options: [
                    {
                        value: '',
                        display_name: defineMessage({id: 'admin.connectionSecurityNone', defaultMessage: 'None'}),
                    },
                    {
                        value: 'TLS',
                        display_name: defineMessage({id: 'admin.connectionSecurityTls', defaultMessage: 'TLS (Recommended)'}),
                    },
                    {
                        value: 'STARTTLS',
                        display_name: defineMessage({id: 'admin.connectionSecurityStart', defaultMessage: 'STARTTLS'}),
                    },
                ],
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'bool',
                key: 'LdapSettings.SkipCertificateVerification',
                label: defineMessage({id: 'admin.ldap.skipCertificateVerification', defaultMessage: 'Skip Certificate Verification:'}),
                help_text: defineMessage({id: 'admin.ldap.skipCertificateVerificationDesc', defaultMessage: 'Skips the certificate verification step for TLS or STARTTLS connections.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.skipCertificateVerificationDescHover', defaultMessage: 'Skipping certificate verification is not recommended for production environments where TLS is required.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.stateIsFalse('LdapSettings.ConnectionSecurity'),
                ),
            },
            {
                type: 'fileupload',
                key: 'LdapSettings.PrivateKeyFile',
                label: defineMessage({id: 'admin.ldap.privateKeyFileTitle', defaultMessage: 'Private Key:'}),
                help_text: defineMessage({id: 'admin.ldap.privateKeyFileFileDesc', defaultMessage: 'The private key file for TLS Certificate.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.privateKeyFileFileDescHover', defaultMessage: 'If using TLS client certificates as primary authentication mechanism. This will be provided by your LDAP Authentication Provider.'}),
                remove_help_text: defineMessage({id: 'admin.ldap.privateKeyFileFileRemoveDesc', defaultMessage: 'Remove the private key file for TLS Certificate.'}),
                remove_button_text: defineMessage({id: 'admin.ldap.remove.privKey', defaultMessage: 'Remove TLS Certificate Private Key'}),
                removing_text: defineMessage({id: 'admin.ldap.removing.privKey', defaultMessage: 'Removing Private Key...'}),
                uploading_text: defineMessage({id: 'admin.ldap.uploading.privateKey', defaultMessage: 'Uploading Private Key...'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                fileType: '.key',
                upload_action: uploadPrivateLdapCertificate,
                remove_action: removePrivateLdapCertificate,
            },
            {
                type: 'fileupload',
                key: 'LdapSettings.PublicCertificateFile',
                label: defineMessage({id: 'admin.ldap.publicCertificateFileTitle', defaultMessage: 'Public Certificate:'}),
                help_text: defineMessage({id: 'admin.ldap.publicCertificateFileDesc', defaultMessage: 'The public certificate file for TLS Certificate.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.publicCertificateFileDescHover', defaultMessage: 'If using TLS client certificates as primary authentication mechanism. This will be provided by your LDAP Authentication Provider.'}),
                remove_help_text: defineMessage({id: 'admin.ldap.publicCertificateFileRemoveDesc', defaultMessage: 'Remove the public certificate file for TLS Certificate.'}),
                remove_button_text: defineMessage({id: 'admin.ldap.remove.sp_certificate', defaultMessage: 'Remove Service Provider Certificate'}),
                removing_text: defineMessage({id: 'admin.ldap.removing.certificate', defaultMessage: 'Removing Certificate...'}),
                uploading_text: defineMessage({id: 'admin.ldap.uploading.certificate', defaultMessage: 'Uploading Certificate...'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                fileType: '.crt,.cer',
                upload_action: uploadPublicLdapCertificate,
                remove_action: removePublicLdapCertificate,
            },
            {
                type: 'number',
                key: 'LdapSettings.MaximumLoginAttempts',
                label: defineMessage({id: 'admin.ldap.maximumLoginAttemptsTitle', defaultMessage: 'Maximum Login Attempts:'}),
                help_text: defineMessage({id: 'admin.ldap.maximumLoginAttemptsDesc', defaultMessage: 'The maximum number of login attempts before the Mattermost account is locked.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.maximumLoginAttemptsDescHover', defaultMessage: 'You can unlock the account in system console on the users page. Setting this value lower than your LDAP maximum login attempts ensures that the users won\'t be locked out of your LDAP server because of failed login attempts in Mattermost.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'button',
                action: ldapTestConnection,
                key: 'LdapSettings.TestConnection',
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                label: defineMessage({id: 'admin.ldap.testConnectionTitle', defaultMessage: 'Test Connection'}),
                help_text: defineMessage({id: 'admin.ldap.testHelpText', defaultMessage: 'Tests if the Mattermost server can connect to the AD/LDAP server specified. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.'}),
                help_text_values: {
                    link: (msg: string) => (
                        <ExternalLink
                            location='admin_console'
                            href={DocLinks.CONFIGURE_AD_LDAP_QUERY_TIMEOUT}
                        >
                            {msg}
                        </ExternalLink>
                    ),
                },
                help_text_markdown: false,
                error_message: defineMessage({id: 'admin.ldap.testConnectionFailure', defaultMessage: 'Test Connection Failure: {error}'}),
                success_message: defineMessage({id: 'admin.ldap.testConnectionSuccess', defaultMessage: 'Test Connection Successful'}),
            },
        ],
    },
    {
        key: 'admin.authentication.ldap.dn_and_filters',
        title: 'User Filters',
        subtitle: 'Tell Mattermost how to identify your users within LDAP',
        settings: [
            {
                type: 'text',
                key: 'LdapSettings.BaseDN',
                label: defineMessage({id: 'admin.ldap.baseTitle', defaultMessage: 'Base DN:'}),
                help_text: defineMessage({id: 'admin.ldap.baseDesc', defaultMessage: 'The Base DN is the Distinguished Name of the location where Mattermost should start its search for user and group objects in the AD/LDAP tree.'}),
                placeholder: defineMessage({id: 'admin.ldap.baseEx', defaultMessage: 'E.g.: "ou=Unit Name,dc=corp,dc=example,dc=com"'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.UserFilter',
                label: defineMessage({id: 'admin.ldap.userFilterTitle', defaultMessage: 'User Filter:'}),
                help_text: defineMessage({id: 'admin.ldap.userFilterDisc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use when searching for user objects. When blank, defaults to the ID Attribute.\nFor Active Directory, the query to filter out disabled users is\n(&(objectCategory=Person)(!(UserAccountControl:1.2.840.113556.1.4.803:=2))).'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.userFilterDiscHover', defaultMessage: 'Only the users selected by the query will be able to access Mattermost.'}),
                placeholder: defineMessage({id: 'admin.ldap.userFilterEx', defaultMessage: 'Ex. "(objectClass=user)"'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'expandable_setting',
                key: 'LdapSettings.AdditionalFilters',
                label: defineMessage({id: 'admin.ldap.configure_additional_filters', defaultMessage: 'Configure additional filters'}),
                settings: [
                    {
                        type: 'text',
                        key: 'LdapSettings.GroupFilter',
                        label: defineMessage({id: 'admin.ldap.groupFilterTitle', defaultMessage: 'Group Filter:'}),
                        help_text: defineMessage({id: 'admin.ldap.groupFilterFilterDesc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use when searching for group objects. From [User Management > Groups]({siteURL}/admin_console/user_management/groups), select which AD/LDAP groups should be linked and configured.'}),
                        help_text_markdown: true,
                        help_text_values: {siteURL: getSiteURL()},
                        help_text_more_info: defineMessage({id: 'admin.ldap.groupFilterFilterDescHover', defaultMessage: 'Only the groups selected by the query will be available to Mattermost.'}),
                        placeholder: defineMessage({id: 'admin.ldap.groupFilterEx', defaultMessage: 'E.g.: "(objectClass=group)"'}),
                        isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                            it.stateIsFalse('LdapSettings.EnableSync'),
                        ),
                    },
                    {
                        type: 'bool',
                        key: 'LdapSettings.EnableAdminFilter',
                        label: defineMessage({id: 'admin.ldap.enableAdminFilterTitle', defaultMessage: 'Enable Admin Filter:'}),
                        isDisabled: it.any(
                            it.not(it.isSystemAdmin),
                            it.all(
                                it.stateIsFalse('LdapSettings.Enable'),
                                it.stateIsFalse('LdapSettings.EnableSync'),
                            ),
                        ),
                    },
                    {
                        type: 'text',
                        key: 'LdapSettings.AdminFilter',
                        label: defineMessage({id: 'admin.ldap.adminFilterTitle', defaultMessage: 'Admin Filter:'}),
                        help_text: defineMessage({id: 'admin.ldap.adminFilterFilterDesc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use for designating System Admins.'}),
                        // eslint-disable-next-line formatjs/no-multiple-whitespaces
                        help_text_more_info: defineMessage({id: 'admin.ldap.adminFilterFilterDescHover', defaultMessage: 'The users selected by the query will have access to your Mattermost server as System Admins. By default, System Admins have complete access to the Mattermost System Console. Existing members that are identified by this attribute will be promoted from member to System Admin upon next login. The next login is based upon Session lengths set in System Console > Session Lengths. It is highly recommend to manually demote users to members in System Console > User Management to ensure access is restricted immediately.\n \nNote: If this filter is removed/changed, System Admins that were promoted via this filter will be demoted to members and will not retain access to the System Console. When this filter is not in use, System Admins can be manually promoted/demoted in System Console > User Management.'}),
                        placeholder: defineMessage({id: 'admin.ldap.adminFilterEx', defaultMessage: 'E.g.: "(objectClass=user)"'}),
                        isDisabled: it.any(
                            it.not(it.isSystemAdmin),
                            it.stateIsFalse('LdapSettings.EnableAdminFilter'),
                            it.all(
                                it.stateIsFalse('LdapSettings.Enable'),
                                it.stateIsFalse('LdapSettings.EnableSync'),
                            ),
                        ),
                    },
                    {
                        type: 'text',
                        key: 'LdapSettings.GuestFilter',
                        label: defineMessage({id: 'admin.ldap.guestFilterTitle', defaultMessage: 'Guest Filter:'}),
                        help_text: defineMessage({id: 'admin.ldap.guestFilterFilterDesc', defaultMessage: '(Optional) Requires Guest Access to be enabled before being applied. Enter an AD/LDAP filter to use when searching for guest objects.'}),
                        // eslint-disable-next-line formatjs/no-multiple-whitespaces
                        help_text_more_info: defineMessage({id: 'admin.ldap.guestFilterFilterDescHover', defaultMessage: 'Only the users selected by the query will be able to access Mattermost as Guests. Guests are prevented from accessing teams or channels upon logging in until they are assigned a team and at least one channel.\n \nNote: If this filter is removed/changed, active guests will not be promoted to a member and will retain their Guest role. Guests can be promoted in System Console > User Management. Existing members that are identified by this attribute as a guest will be demoted from a member to a guest when they are asked to login next. The next login is based upon Session lengths set in System Console > Session Lengths. It is highly recommend to manually demote users to guests in System Console > User Management  to ensure access is restricted immediately.'}),
                        placeholder: defineMessage({id: 'admin.ldap.guestFilterEx', defaultMessage: 'E.g.: "(objectClass=user)"'}),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                            it.configIsFalse('GuestAccountsSettings', 'Enable'),
                            it.all(
                                it.stateIsFalse('LdapSettings.Enable'),
                                it.stateIsFalse('LdapSettings.EnableSync'),
                            ),
                        ),
                    },
                ],
            },
            {
                type: 'button',
                action: ldapTestFilters,
                key: 'LdapSettings.TestFilters',
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                label: defineMessage({id: 'admin.ldap.testFiltersTitle', defaultMessage: 'Test Filters'}),
                help_text: defineMessage({id: 'admin.ldap.testFiltersHelpText', defaultMessage: '**Note**: This test is similar in scope to an LDAP sync and may take time depending on the size of the LDAP Server, hardware, or network conditions.'}),
                help_text_markdown: true,
                error_message: defineMessage({id: 'admin.ldap.testFiltersFailure', defaultMessage: 'We failed to apply some filters: {error}'}),
                success_message: defineMessage({id: 'admin.ldap.testFiltersSuccess', defaultMessage: 'Test Successful'}),
            },
        ],
    },
    {
        key: 'admin.authentication.ldap.account_synchronization',
        title: 'Synchronise user account properties',
        sectionTitle: 'Account sync',
        settings: [
            {
                type: 'text',
                key: 'LdapSettings.IdAttribute',
                label: defineMessage({id: 'admin.ldap.idAttrTitle', defaultMessage: 'ID Attribute: '}),
                placeholder: defineMessage({id: 'admin.ldap.idAttrEx', defaultMessage: 'E.g.: "objectGUID" or "uid"'}),
                help_text: defineMessage({id: 'admin.ldap.idAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used as a unique identifier in Mattermost. If you need to change this field after users have already logged in, use the <link>mattermost ldap idmigrate</link> CLI tool.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.idAttrDescHover', defaultMessage: 'It should be an AD/LDAP attribute with a value that does not change such as uid for LDAP or objectGUID for Active Directory. If a user\'s ID Attribute changes, it will create a new Mattermost account unassociated with their old one.'}),
                help_text_markdown: false,
                help_text_values: {
                    link: (msg: string) => (
                        <ExternalLink
                            location='admin_console'
                            href='https://docs.mattermost.com/manage/command-line-tools.html#mattermost-ldap-idmigrate'
                        >
                            {msg}
                        </ExternalLink>
                    ),
                },
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateEquals('LdapSettings.Enable', false),
                        it.stateEquals('LdapSettings.EnableSync', false),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.LoginIdAttribute',
                label: defineMessage({id: 'admin.ldap.loginAttrTitle', defaultMessage: 'Login ID Attribute: '}),
                placeholder: defineMessage({id: 'admin.ldap.loginIdAttrEx', defaultMessage: 'E.g.: "sAMAccountName"'}),
                help_text: defineMessage({id: 'admin.ldap.loginAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to log in to Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.loginAttrDescHover', defaultMessage: 'Normally this attribute is the same as the "Username Attribute" field above. If your team typically uses domain/username to log in to other services with AD/LDAP, you may enter domain/username in this field to maintain consistency between sites.'}),
                help_text_markdown: false,
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.UsernameAttribute',
                label: defineMessage({id: 'admin.ldap.usernameAttrTitle', defaultMessage: 'Username Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.usernameAttrEx', defaultMessage: 'E.g.: "sAMAccountName"'}),
                help_text: defineMessage({id: 'admin.ldap.usernameAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the username field in Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.usernameAttrDescHover', defaultMessage: 'This may be the same as the Login ID Attribute.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.EmailAttribute',
                label: defineMessage({id: 'admin.ldap.emailAttrTitle', defaultMessage: 'Email Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.emailAttrEx', defaultMessage: 'E.g.: "mail" or "userPrincipalName"'}),
                help_text: defineMessage({id: 'admin.ldap.emailAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the email address field in Mattermost.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.FirstNameAttribute',
                label: defineMessage({id: 'admin.ldap.firstnameAttrTitle', defaultMessage: 'First Name Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.firstnameAttrEx', defaultMessage: 'E.g.: "givenName"'}),
                help_text: defineMessage({id: 'admin.ldap.firstnameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the first name of users in Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.firstnameAttrDescHover', defaultMessage: 'When set, users cannot edit their first name, since it is synchronized with the LDAP server. When left blank, users can set their first name in Account Menu > Account Settings > Profile.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.LastNameAttribute',
                label: defineMessage({id: 'admin.ldap.lastnameAttrTitle', defaultMessage: 'Last Name Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.lastnameAttrEx', defaultMessage: 'E.g.: "sn"'}),
                help_text: defineMessage({id: 'admin.ldap.lastnameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the last name of users in Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.lastnameAttrDescHover', defaultMessage: 'When set, users cannot edit their last name, since it is synchronized with the LDAP server. When left blank, users can set their last name in Account Menu > Account Settings > Profile.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.NicknameAttribute',
                label: defineMessage({id: 'admin.ldap.nicknameAttrTitle', defaultMessage: 'Nickname Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.nicknameAttrEx', defaultMessage: 'E.g.: "nickname"'}),
                help_text: defineMessage({id: 'admin.ldap.nicknameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the nickname of users in Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.nicknameAttrDescHover', defaultMessage: 'When set, users cannot edit their nickname, since it is synchronized with the LDAP server. When left blank, users can set their nickname in Account Menu > Account Settings > Profile.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.PositionAttribute',
                label: defineMessage({id: 'admin.ldap.positionAttrTitle', defaultMessage: 'Position Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.positionAttrEx', defaultMessage: 'E.g.: "title"'}),
                help_text: defineMessage({id: 'admin.ldap.positionAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the position field in Mattermost.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.positionAttrDescHover', defaultMessage: 'When set, users cannot edit their position, since it is synchronized with the LDAP server. When left blank, users can set their position in Account Menu > Account Settings > Profile.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.PictureAttribute',
                label: defineMessage({id: 'admin.ldap.pictureAttrTitle', defaultMessage: 'Profile Picture Attribute:'}),
                placeholder: defineMessage({id: 'admin.ldap.pictureAttrEx', defaultMessage: 'E.g.: "thumbnailPhoto" or "jpegPhoto"'}),
                help_text: defineMessage({id: 'admin.ldap.pictureAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the profile picture in Mattermost.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'button',
                action: ldapTestAttributes,
                key: 'LdapSettings.TestAttributes',
                label: defineMessage({id: 'admin.ldap.testAttributesTitle', defaultMessage: 'Test Attributes'}),
                help_text: defineMessage({id: 'admin.ldap.testFiltersHelpText', defaultMessage: '**Note**: This test is similar in scope to an LDAP sync and may take time depending on the size of the LDAP Server, hardware, or network conditions.'}),
                help_text_markdown: true,
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                error_message: defineMessage({id: 'admin.ldap.testAttributesFailure', defaultMessage: 'We failed to find some attributes: {error}'}),
                success_message: defineMessage({id: 'admin.ldap.testAttributesSuccess', defaultMessage: 'Test Successful'}),
            },
            {
                type: 'custom',
                key: 'LdapSettings.CustomProfileAttributes',
                component: CustomProfileAttributes,
                isHidden: it.not(it.all(
                    it.minLicenseTier(LicenseSkus.Enterprise),
                    it.configIsTrue('FeatureFlags', 'CustomProfileAttributes'),
                )),
            },
        ],
    },
    {
        key: 'admin.authentication.ldap.group_synchronization',
        title: 'Group Synchronization',
        settings: [
            {
                type: 'text',
                key: 'LdapSettings.GroupDisplayNameAttribute',
                label: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeTitle', defaultMessage: 'Group Display Name Attribute:'}),
                help_text: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the group display names.'}),
                placeholder: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeEx', defaultMessage: 'E.g.: "cn"'}),
                isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.stateIsFalse('LdapSettings.EnableSync'),
                ),
            },
            {
                type: 'text',
                key: 'LdapSettings.GroupIdAttribute',
                label: defineMessage({id: 'admin.ldap.groupIdAttributeTitle', defaultMessage: 'Group ID Attribute:'}),
                help_text: defineMessage({id: 'admin.ldap.groupIdAttributeDesc', defaultMessage: 'The attribute in the AD/LDAP server used as a unique identifier for Groups.'}),
                help_text_more_info: defineMessage({id: 'admin.ldap.groupIdAttributeDescHover', defaultMessage: 'This should be a AD/LDAP attribute with a value that does not change such as entryUUID for LDAP or objectGUID for Active Directory.'}),
                help_text_markdown: false,
                placeholder: defineMessage({id: 'admin.ldap.groupIdAttributeEx', defaultMessage: 'E.g.: "objectGUID" or "entryUUID"'}),
                isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.stateIsFalse('LdapSettings.EnableSync'),
                ),
            },
            {
                type: 'button',
                action: ldapTestGroupAttributes,
                key: 'LdapSettings.TestGroupAttributes',
                label: defineMessage({id: 'admin.ldap.testGroupAttributesTitle', defaultMessage: 'Test Group Attributes'}),
                help_text: defineMessage({id: 'admin.ldap.testFiltersHelpText', defaultMessage: '**Note**: This test is similar in scope to an LDAP sync and may take time depending on the size of the LDAP Server, hardware, or network conditions.'}),
                help_text_markdown: true,
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
                error_message: defineMessage({id: 'admin.ldap.testGroupAttributesFailure', defaultMessage: 'We failed to find some attributes: {error}'}),
                success_message: defineMessage({id: 'admin.ldap.testGroupAttributesSuccess', defaultMessage: 'Test Successful'}),
            },
        ],
    },
    {
        key: 'admin.authentication.ldap.synchronization_performance',
        title: 'Synchronization Performance',
        sectionTitle: 'Sync Performance',
        settings: [
            {
                type: 'number',
                key: 'LdapSettings.SyncIntervalMinutes',
                label: defineMessage({id: 'admin.ldap.syncIntervalTitle', defaultMessage: 'Synchronization Interval (minutes):'}),
                help_text: defineMessage({id: 'admin.ldap.syncIntervalHelpText', defaultMessage: 'AD/LDAP Synchronization updates Mattermost user information to reflect updates on the AD/LDAP server. For example, when a user\'s name changes on the AD/LDAP server, the change updates in Mattermost when synchronization is performed. Accounts removed from or disabled in the AD/LDAP server have their Mattermost accounts set to "Inactive" and have their account sessions revoked. Mattermost performs synchronization on the interval entered. For example, if 60 is entered, Mattermost synchronizes every 60 minutes.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'number',
                key: 'LdapSettings.MaxPageSize',
                label: defineMessage({id: 'admin.ldap.maxPageSizeTitle', defaultMessage: 'Maximum Page Size:'}),
                placeholder: defineMessage({id: 'admin.ldap.maxPageSizeEx', defaultMessage: 'E.g.: "2000"'}),
                help_text: defineMessage({id: 'admin.ldap.maxPageSizeHelpText', defaultMessage: 'The maximum number of users the Mattermost server will request from the AD/LDAP server at one time. 0 is unlimited.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
            {
                type: 'number',
                key: 'LdapSettings.QueryTimeout',
                label: defineMessage({id: 'admin.ldap.queryTitle', defaultMessage: 'Query Timeout (seconds):'}),
                placeholder: defineMessage({id: 'admin.ldap.queryEx', defaultMessage: 'E.g.: "60"'}),
                help_text: defineMessage({id: 'admin.ldap.queryDesc', defaultMessage: 'The timeout value for queries to the AD/LDAP server. Increase if you are getting timeout errors caused by a slow AD/LDAP server.'}),
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.all(
                        it.stateIsFalse('LdapSettings.Enable'),
                        it.stateIsFalse('LdapSettings.EnableSync'),
                    ),
                ),
            },
        ],
    },
    {
        key: 'admin.authentication.ldap.synchronization_history',
        title: 'Synchronize users to the system',
        subtitle: 'See the table below for the status of each synchronization',
        sectionTitle: 'Sync History',
        settings: [
            {
                type: 'jobstable',
                job_type: Constants.JobTypes.LDAP_SYNC,
                label: defineMessage({id: 'admin.ldap.sync_button', defaultMessage: 'AD/LDAP Synchronize Now'}),
                help_text: defineMessage({id: 'admin.ldap.syncNowHelpText', defaultMessage: 'Initiates an AD/LDAP synchronization immediately. See the table below for status of each synchronization. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.'}),
                help_text_markdown: false,
                help_text_values: {
                    link: (msg: string) => (
                        <ExternalLink
                            location='admin_console'
                            href={DocLinks.SETUP_LDAP}
                        >
                            {msg}
                        </ExternalLink>
                    ),
                },
                isDisabled: it.any(
                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                    it.stateIsFalse('LdapSettings.EnableSync'),
                ),
                render_job: (job: Job) => {
                    if (job.status === 'pending') {
                        return <span>{'--'}</span>;
                    }

                    let ldapUsers = 0;
                    let deleteCount = 0;
                    let updateCount = 0;
                    let linkedLdapGroupsCount; // Deprecated.
                    let totalLdapGroupsCount = 0;
                    let groupDeleteCount = 0;
                    let groupMemberDeleteCount = 0;
                    let groupMemberAddCount = 0;

                    if (job && job.data) {
                        if (job.data.ldap_users_count && job.data.ldap_users_count.length > 0) {
                            ldapUsers = job.data.ldap_users_count;
                        }

                        if (job.data.delete_count && job.data.delete_count.length > 0) {
                            deleteCount = job.data.delete_count;
                        }

                        if (job.data.update_count && job.data.update_count.length > 0) {
                            updateCount = job.data.update_count;
                        }

                        // Deprecated groups count representing the number of linked LDAP groups.
                        if (job.data.ldap_groups_count) {
                            linkedLdapGroupsCount = job.data.ldap_groups_count;
                        }

                        // Groups count representing the total number of LDAP groups available based on
                        // the configured based DN and groups filter.
                        if (job.data.total_ldap_groups_count) {
                            totalLdapGroupsCount = job.data.total_ldap_groups_count;
                        }

                        if (job.data.group_delete_count) {
                            groupDeleteCount = job.data.group_delete_count;
                        }

                        if (job.data.group_member_delete_count) {
                            groupMemberDeleteCount = job.data.group_member_delete_count;
                        }

                        if (job.data.group_member_add_count) {
                            groupMemberAddCount = job.data.group_member_add_count;
                        }
                    }

                    return (
                        <span>
                            <FormattedMessage
                                id={linkedLdapGroupsCount ? 'admin.ldap.jobExtraInfo' : 'admin.ldap.jobExtraInfoTotal'}
                                defaultMessage={linkedLdapGroupsCount ? 'Scanned {ldapUsers, number} LDAP users and {ldapGroups, number} linked groups.' : 'Scanned {ldapUsers, number} LDAP users and {ldapGroups, number} groups.'}
                                values={{
                                    ldapUsers,
                                    ldapGroups: linkedLdapGroupsCount || totalLdapGroupsCount, // Show the old count for jobs records containing the old JSON key.
                                }}
                            />
                            <ul>
                                {updateCount > 0 &&
                                    <li>
                                        <FormattedMessage
                                            id='admin.ldap.jobExtraInfo.updatedUsers'
                                            defaultMessage='Updated {updateCount, number} users.'
                                            values={{
                                                updateCount,
                                            }}
                                        />
                                    </li>
                                }
                                {deleteCount > 0 &&
                                    <li>
                                        <FormattedMessage
                                            id='admin.ldap.jobExtraInfo.deactivatedUsers'
                                            defaultMessage='Deactivated {deleteCount, number} users.'
                                            values={{
                                                deleteCount,
                                            }}
                                        />
                                    </li>
                                }
                                {groupDeleteCount > 0 &&
                                    <li>
                                        <FormattedMessage
                                            id='admin.ldap.jobExtraInfo.deletedGroups'
                                            defaultMessage='Deleted {groupDeleteCount, number} groups.'
                                            values={{
                                                groupDeleteCount,
                                            }}
                                        />
                                    </li>
                                }
                                {groupMemberDeleteCount > 0 &&
                                    <li>
                                        <FormattedMessage
                                            id='admin.ldap.jobExtraInfo.deletedGroupMembers'
                                            defaultMessage='Deleted {groupMemberDeleteCount, number} group members.'
                                            values={{
                                                groupMemberDeleteCount,
                                            }}
                                        />
                                    </li>
                                }
                                {groupMemberAddCount > 0 &&
                                    <li>
                                        <FormattedMessage
                                            id='admin.ldap.jobExtraInfo.addedGroupMembers'
                                            defaultMessage='Added {groupMemberAddCount, number} group members.'
                                            values={{
                                                groupMemberAddCount,
                                            }}
                                        />
                                    </li>
                                }
                            </ul>
                        </span>
                    );
                },
            },
        ],
    }],
};
