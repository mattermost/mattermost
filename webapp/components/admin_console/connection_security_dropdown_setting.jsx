// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import * as Utils from 'utils/utils.jsx';

import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';

const SECTION_NONE = (
    <tr>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityNone'
                defaultMessage='None'
            />
        </td>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityNoneDescription'
                defaultMessage='Mattermost will connect over an unsecure connection.'
            />
        </td>
    </tr>
);

const SECTION_PLAIN = (
    <tr>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityPlain'
                defaultMessage='PLAIN'
            />
        </td>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityPlainDescription'
                defaultMessage='Mattermost will connect and authenticate over an unsecure connection.'
            />
        </td>
    </tr>
);

const SECTION_TLS = (
    <tr>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityTls'
                defaultMessage='TLS'
            />
        </td>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityTlsDescription'
                defaultMessage='Encrypts the communication between Mattermost and your server.'
            />
        </td>
    </tr>
);

const SECTION_STARTTLS = (
    <tr>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityStart'
                defaultMessage='STARTTLS'
            />
        </td>
        <td>
            <FormattedMessage
                id='admin.connectionSecurityStartDescription'
                defaultMessage='Takes an existing insecure connection and attempts to upgrade it to a secure connection using TLS.'
            />
        </td>
    </tr>
);

const CONNECTION_SECURITY_HELP_TEXT_EMAIL = (
    <table
        className='table table-bordered table-margin--none'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_PLAIN}
            {SECTION_TLS}
            {SECTION_STARTTLS}
        </tbody>
    </table>
);

const CONNECTION_SECURITY_HELP_TEXT_LDAP = (
    <table
        className='table table-bordered table-margin--none'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_TLS}
            {SECTION_STARTTLS}
        </tbody>
    </table>
);

const CONNECTION_SECURITY_HELP_TEXT_WEBSERVER = (
    <table
        className='table table-bordered table-margin--none'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_TLS}
        </tbody>
    </table>
);

export class ConnectionSecurityDropdownSettingEmail extends React.Component { //eslint-disable-line react/no-multi-comp
    render() {
        return (
            <DropdownSetting
                id='connectionSecurity'
                values={[
                    {value: '', text: Utils.localizeMessage('admin.connectionSecurityNone', 'None')},
                    {value: 'PLAIN', text: Utils.localizeMessage('admin.connectionSecurityPlain')},
                    {value: 'TLS', text: Utils.localizeMessage('admin.connectionSecurityTls', 'TLS (Recommended)')},
                    {value: 'STARTTLS', text: Utils.localizeMessage('admin.connectionSecurityStart')}
                ]}
                label={
                    <FormattedMessage
                        id='admin.connectionSecurityTitle'
                        defaultMessage='Connection Security:'
                    />
                }
                value={this.props.value}
                onChange={this.props.onChange}
                disabled={this.props.disabled}
                helpText={CONNECTION_SECURITY_HELP_TEXT_EMAIL}
            />
        );
    }
}
ConnectionSecurityDropdownSettingEmail.defaultProps = {
};

ConnectionSecurityDropdownSettingEmail.propTypes = {
    value: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    disabled: React.PropTypes.bool.isRequired
};

export class ConnectionSecurityDropdownSettingLdap extends React.Component { //eslint-disable-line react/no-multi-comp
    render() {
        return (
            <DropdownSetting
                id='connectionSecurity'
                values={[
                    {value: '', text: Utils.localizeMessage('admin.connectionSecurityNone', 'None')},
                    {value: 'TLS', text: Utils.localizeMessage('admin.connectionSecurityTls', 'TLS (Recommended)')},
                    {value: 'STARTTLS', text: Utils.localizeMessage('admin.connectionSecurityStart')}
                ]}
                label={
                    <FormattedMessage
                        id='admin.connectionSecurityTitle'
                        defaultMessage='Connection Security:'
                    />
                }
                value={this.props.value}
                onChange={this.props.onChange}
                disabled={this.props.disabled}
                helpText={CONNECTION_SECURITY_HELP_TEXT_LDAP}
            />
        );
    }
}
ConnectionSecurityDropdownSettingLdap.defaultProps = {
};

ConnectionSecurityDropdownSettingLdap.propTypes = {
    value: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    disabled: React.PropTypes.bool.isRequired
};

export class ConnectionSecurityDropdownSettingWebserver extends React.Component { //eslint-disable-line react/no-multi-comp
    render() {
        return (
            <DropdownSetting
                id='connectionSecurity'
                values={[
                    {value: '', text: Utils.localizeMessage('admin.connectionSecurityNone', 'None')},
                    {value: 'TLS', text: Utils.localizeMessage('admin.connectionSecurityTls', 'TLS (Recommended)')}
                ]}
                label={
                    <FormattedMessage
                        id='admin.connectionSecurityTitle'
                        defaultMessage='Connection Security:'
                    />
                }
                value={this.props.value}
                onChange={this.props.onChange}
                disabled={this.props.disabled}
                helpText={CONNECTION_SECURITY_HELP_TEXT_WEBSERVER}
            />
        );
    }
}
ConnectionSecurityDropdownSettingWebserver.defaultProps = {
};

ConnectionSecurityDropdownSettingWebserver.propTypes = {
    value: React.PropTypes.string.isRequired,
    onChange: React.PropTypes.func.isRequired,
    disabled: React.PropTypes.bool.isRequired
};
