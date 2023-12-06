// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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
                defaultMessage='Mattermost will connect over an insecure connection.'
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

export const CONNECTION_SECURITY_HELP_TEXT_EMAIL = (
    <table
        className='table table-bordered'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_TLS}
            {SECTION_STARTTLS}
        </tbody>
    </table>
);

export const CONNECTION_SECURITY_HELP_TEXT_LDAP = (
    <table
        className='table table-bordered'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_TLS}
            {SECTION_STARTTLS}
        </tbody>
    </table>
);

export const CONNECTION_SECURITY_HELP_TEXT_WEBSERVER = (
    <table
        className='table table-bordered'
        cellPadding='5'
    >
        <tbody>
            {SECTION_NONE}
            {SECTION_TLS}
        </tbody>
    </table>
);

export const WEBSERVER_MODE_HELP_TEXT = (
    <div>
        <table
            className='table table-bordered'
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

export const LOG_LEVEL_OPTIONS = [
    {
        value: 'DEBUG',
        display_name: 'DEBUG',
        display_name_default: 'DEBUG',
    },
    {
        value: 'INFO',
        display_name: 'INFO',
        display_name_default: 'INFO',
    },
    {
        value: 'ERROR',
        display_name: 'ERROR',
        display_name_default: 'ERROR',
    },
];
