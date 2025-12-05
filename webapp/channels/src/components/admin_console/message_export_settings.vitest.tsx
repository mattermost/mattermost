// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MessageExportSettings from 'components/admin_console/message_export_settings';

import {renderWithContext, waitFor, screen} from 'tests/vitest_react_testing_utils';

describe('components/MessageExportSettings', () => {
    test('should match snapshot, disabled, actiance', async () => {
        const config = {
            MessageExportSettings: {
                EnableExport: false,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 0,
                BatchSize: 10000,
            },
        };

        const {container} = renderWithContext(
            <MessageExportSettings config={config}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled, actiance', async () => {
        const config = {
            MessageExportSettings: {
                EnableExport: true,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
            },
        };

        const {container} = renderWithContext(
            <MessageExportSettings config={config}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, disabled, globalrelay', async () => {
        const config = {
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
        };

        const {container} = renderWithContext(
            <MessageExportSettings config={config}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled, globalrelay', async () => {
        const config = {
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
        };

        const {container} = renderWithContext(
            <MessageExportSettings config={config}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});

describe('components/MessageExportSettings/getJobDetails', () => {
    const baseProps = {
        config: {
            MessageExportSettings: {
                EnableExport: true,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: 12345678,
                BatchSize: 10000,
            },
        },
    };

    test('test no data', async () => {
        const {container} = renderWithContext(
            <MessageExportSettings {...baseProps}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('test success message, missing warnings', async () => {
        const {container} = renderWithContext(
            <MessageExportSettings {...baseProps}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('test success message, 0 warnings', async () => {
        const {container} = renderWithContext(
            <MessageExportSettings {...baseProps}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('test warning message', async () => {
        const {container} = renderWithContext(
            <MessageExportSettings {...baseProps}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('test progress message', async () => {
        const {container} = renderWithContext(
            <MessageExportSettings {...baseProps}/>,
        );

        // Wait for async JobTable updates to complete
        await waitFor(() => {
            expect(screen.getByText('Enable Compliance Export:')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
