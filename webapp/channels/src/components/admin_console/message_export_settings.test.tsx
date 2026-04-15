// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Job} from '@mattermost/types/jobs';

import MessageExportSettingsDefault, {MessageExportSettings} from 'components/admin_console/message_export_settings';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

import type {BaseProps} from './old_admin_settings';

describe('components/MessageExportSettings', () => {
    test('should match snapshot, disabled, actiance', () => {
        const config = {
            MessageExportSettings: {
                EnableExport: false,
                ExportFormat: 'actiance',
                DailyRunTime: '01:00',
                ExportFromTimestamp: null,
                BatchSize: 10000,
            },
        } as unknown as BaseProps['config'];

        const {container} = renderWithContext(
            <MessageExportSettingsDefault
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled, actiance', () => {
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
            <MessageExportSettingsDefault
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, disabled, globalrelay', () => {
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
            <MessageExportSettingsDefault
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enabled, globalrelay', () => {
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
            <MessageExportSettingsDefault
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});

describe('components/MessageExportSettings/getJobDetails', () => {
    const baseProps = {
        intl: defaultIntl,
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

    let ref: React.RefObject<MessageExportSettings>;

    beforeEach(() => {
        ref = React.createRef<MessageExportSettings>();
        renderWithContext(
            <MessageExportSettings
                {...baseProps}
                ref={ref}
            />,
        );
    });

    function runTest(testJob: Job, expectNull: boolean, expectedCount: number, expectedMessage = '') {
        const jobDetails = ref.current!.getJobDetails(testJob);
        if (expectNull) {
            expect(jobDetails).toBe(null);
        } else {
            expect(jobDetails?.length).toBe(expectedCount);
        }
        if (expectedMessage) {
            expect(jobDetails?.[0].props.children).toEqual(expectedMessage);
        }
    }

    const job = {} as Job;
    test('test no data', () => {
        runTest(job, true, 0);
    });

    test('test success message, missing warnings', () => {
        job.data = {
            messages_exported: 3,
        };
        runTest(job, false, 1);
    });

    test('test success message, 0 warnings', () => {
        job.data = {
            messages_exported: 3,
            warning_count: 0,
        };
        runTest(job, false, 1);
    });

    test('test warning message', () => {
        job.data = {
            messages_exported: 3,
            warning_count: 2,
        };
        runTest(job, false, 2);
    });

    test('test progress message', () => {
        job.data = {
            messages_exported: 0,
            warning_count: 0,
            progress_message: 'this is a custom progress message',
        };
        runTest(job, false, 1, 'this is a custom progress message');
    });
});
