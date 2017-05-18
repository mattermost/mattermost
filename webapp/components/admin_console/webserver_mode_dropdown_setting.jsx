import PropTypes from 'prop-types';

// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import * as Utils from 'utils/utils.jsx';

import DropdownSetting from './dropdown_setting.jsx';
import {FormattedMessage} from 'react-intl';

const WEBSERVER_MODE_HELP_TEXT = (
    <div>
        <table
            className='table table-bordered table-margin--none'
            cellPadding='5'
        >
            <tbody>
                <tr>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeGzip'
                            defaultMessage='gzip'
                        />
                    </td>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeGzipDescription'
                            defaultMessage='The Mattermost server will serve static files compressed with gzip.'
                        />
                    </td>
                </tr>
                <tr>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeUncompressed'
                            defaultMessage='Uncompressed'
                        />
                    </td>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeUncompressedDescription'
                            defaultMessage='The Mattermost server will serve static files uncompressed.'
                        />
                    </td>
                </tr>
                <tr>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeDisabled'
                            defaultMessage='Disabled'
                        />
                    </td>
                    <td>
                        <FormattedMessage
                            id='admin.webserverModeDisabledDescription'
                            defaultMessage='The Mattermost server will not serve static files.'
                        />
                    </td>
                </tr>
            </tbody>
        </table>
        <p className='help-text'>
            <FormattedMessage
                id='admin.webserverModeHelpText'
                defaultMessage='gzip compression applies to static content files. It is recommended to enable gzip to improve performance unless your environment has specific restrictions, such as a web proxy that distributes gzip files poorly.'
            />
        </p>
    </div>
);

export default function WebserverModeDropdownSetting(props) {
    return (
        <DropdownSetting
            id='webserverMode'
            values={[
                {value: 'gzip', text: Utils.localizeMessage('admin.webserverModeGzip', 'gzip')},
                {value: 'uncompressed', text: Utils.localizeMessage('admin.webserverModeUncompressed', 'Uncompressed')},
                {value: 'disabled', text: Utils.localizeMessage('admin.webserverModeDisabled', 'Disabled')}
            ]}
            label={
                <FormattedMessage
                    id='admin.webserverModeTitle'
                    defaultMessage='Webserver Mode:'
                />
            }
            value={props.value}
            onChange={props.onChange}
            disabled={props.disabled}
            helpText={WEBSERVER_MODE_HELP_TEXT}
        />
    );
}
WebserverModeDropdownSetting.defaultProps = {
};

WebserverModeDropdownSetting.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool.isRequired
};
