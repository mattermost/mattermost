// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import MessageExportSettings from './message_export_settings';

describe('components/admin_console/message_export_settings', () => {
    const defaultProps = {
        config: {
            MessageExportSettings: {
                EnableExport: false,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: null,
                BatchSize: 10000,
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the message export settings page', () => {
        renderWithContext(<MessageExportSettings {...defaultProps}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with export enabled', () => {
        const props = {
            config: {
                MessageExportSettings: {
                    ...defaultProps.config.MessageExportSettings,
                    EnableExport: true,
                },
            },
        };

        renderWithContext(<MessageExportSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with actiance format', () => {
        const props = {
            config: {
                MessageExportSettings: {
                    ...defaultProps.config.MessageExportSettings,
                    ExportFormat: 'actiance',
                },
            },
        };

        renderWithContext(<MessageExportSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with globalrelay format', () => {
        const props = {
            config: {
                MessageExportSettings: {
                    EnableExport: false,
                    ExportFormat: 'globalrelay',
                    DailyRunTime: '01:00',
                    ExportFromTimestamp: 12345678,
                    BatchSize: 10000,
                    GlobalRelaySettings: {
                        CustomerType: 'A10',
                        SMTPUsername: 'globalRelayUser',
                        SMTPPassword: 'globalRelayPassword',
                        EmailAddress: 'globalRelay@mattermost.com',
                        CustomSMTPServerName: '',
                        CustomSMTPPort: '25',
                    },
                },
            },
        };

        renderWithContext(<MessageExportSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with globalrelay format enabled', () => {
        const props = {
            config: {
                MessageExportSettings: {
                    EnableExport: true,
                    ExportFormat: 'globalrelay',
                    DailyRunTime: '01:00',
                    ExportFromTimestamp: 12345678,
                    BatchSize: 10000,
                    GlobalRelaySettings: {
                        CustomerType: 'A10',
                        SMTPUsername: 'globalRelayUser',
                        SMTPPassword: 'globalRelayPassword',
                        EmailAddress: 'globalRelay@mattermost.com',
                        CustomSMTPServerName: '',
                        CustomSMTPPort: '25',
                    },
                },
            },
        };

        renderWithContext(<MessageExportSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });
});
