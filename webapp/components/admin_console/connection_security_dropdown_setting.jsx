// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import * as Utils from 'utils/utils.jsx';

import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';

const CONNECTION_SECURITY_HELP_TEXT = (
    <div className='help-text'>
        <table
            className='table table-bordered'
            cellPadding='5'
        >
            <tbody>
                <tr>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityNone'
                            defaultMessage='None'
                        />
                    </td>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityNoneDescription'
                            defaultMessage='Mattermost will connect over an unsecure connection.'
                        />
                    </td>
                </tr>
                <tr>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityTls'
                            defaultMessage='TLS'
                        />
                    </td>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityTlsDescription'
                            defaultMessage='Encrypts the communication between Mattermost and your server.'
                        />
                    </td>
                </tr>
                <tr>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityStart'
                            defaultMessage='STARTTLS'
                        />
                    </td>
                    <td className='help-text'>
                        <FormattedMessage
                            id='admin.connectionSecurityStartDescription'
                            defaultMessage='Takes an existing insecure connection and attempts to upgrade it to a secure connection using TLS.'
                        />
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
);

export default class ConnectionSecurityDropdownSetting extends React.Component {
    render() {
        return (
            <DropdownSetting
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
                currentValue={this.props.currentValue}
                handleChange={this.props.handleChange}
                isDisabled={this.props.isDisabled}
                helpText={CONNECTION_SECURITY_HELP_TEXT}
            />
        );
    }
}
ConnectionSecurityDropdownSetting.defaultProps = {
};

ConnectionSecurityDropdownSetting.propTypes = {
    currentValue: React.PropTypes.string.isRequired,
    handleChange: React.PropTypes.func.isRequired,
    isDisabled: React.PropTypes.bool.isRequired
};
