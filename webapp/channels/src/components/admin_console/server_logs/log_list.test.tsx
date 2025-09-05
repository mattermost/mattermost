// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Import the function we need to test
// Since formatLogTimestamp is not exported, we'll need to test it indirectly through the component
import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';
import type {LogObject} from '@mattermost/types/admin';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import LogList from './log_list';

describe('components/admin_console/server_logs/LogList', () => {
    describe('formatLogTimestamp function (via component)', () => {
        const mockProps = {
            loading: false,
            logs: [] as LogObject[],
            onFiltersChange: jest.fn(),
            onSearchChange: jest.fn(),
            search: '',
            filters: {
                dateFrom: '',
                dateTo: '',
                logLevels: [],
                serverNames: [],
            },
        };

        // No need to mock Date methods - we'll test the actual behavior

        test('should format valid ISO timestamp to local time', () => {
            const logWithISOTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-04T14:32:24Z',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithISOTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');

            // Should format the timestamp to local time
            const formattedText = timestampElement.textContent;
            expect(formattedText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/); // Should match MM/DD/YYYY HH:mm:ss pattern
            expect(formattedText).not.toBe('2025-09-04T14:32:24Z'); // Should not be the original UTC string
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-09-04T14:32:24Z');
        });

        test('should format valid ISO timestamp with milliseconds to local time', () => {
            const logWithMillisTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-04T14:32:24.123Z',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithMillisTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            const formattedText = timestampElement.textContent;
            expect(formattedText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
            expect(formattedText).not.toBe('2025-09-04T14:32:24.123Z');
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-09-04T14:32:24.123Z');
        });

        test('should format valid ISO timestamp without Z suffix to local time', () => {
            const logWithTTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-04T14:32:24',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithTTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            const formattedText = timestampElement.textContent;
            expect(formattedText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
            expect(formattedText).not.toBe('2025-09-04T14:32:24');
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-09-04T14:32:24');
        });

        test('should preserve test strings unchanged', () => {
            const logWithTestString: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: 'timestamp 1',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithTestString]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            expect(timestampElement).toHaveTextContent('timestamp 1');
            expect(timestampElement).not.toHaveAttribute('title');
        });

        test('should preserve simple strings without date indicators', () => {
            const logWithSimpleString: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: 'some random string',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithSimpleString]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            expect(timestampElement).toHaveTextContent('some random string');
            expect(timestampElement).not.toHaveAttribute('title');
        });

        test('should handle invalid ISO timestamps gracefully', () => {
            const logWithInvalidTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-13-45T25:99:99Z', // Invalid date
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithInvalidTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            expect(timestampElement).toHaveTextContent('2025-13-45T25:99:99Z');
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-13-45T25:99:99Z');
        });

        test('should handle empty timestamp strings', () => {
            const logWithEmptyTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithEmptyTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            expect(timestampElement).toHaveTextContent('');
            expect(timestampElement).not.toHaveAttribute('title');
        });

        test('should handle epoch timestamps with dashes', () => {
            const logWithEpochDash: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '1693834344-123', // Contains dash but not timestamp format
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithEpochDash]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');

            // Should not format it since it doesn't match timestamp pattern
            expect(timestampElement).toHaveTextContent('1693834344-123');
            expect(timestampElement).not.toHaveAttribute('title');
        });

        test('should format server timestamp format to local time', () => {
            const logWithServerTimestamp: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-05 08:18:24.558',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithServerTimestamp]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            const formattedText = timestampElement.textContent;
            expect(formattedText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
            expect(formattedText).not.toBe('2025-09-05 08:18:24.558');
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-09-05 08:18:24.558');
        });

        test('should format server timestamp without milliseconds', () => {
            const logWithServerTimestampNoMs: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-05 08:18:24',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithServerTimestampNoMs]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            const formattedText = timestampElement.textContent;
            expect(formattedText).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/);
            expect(formattedText).not.toBe('2025-09-05 08:18:24');
            expect(timestampElement).toHaveAttribute('title', 'UTC: 2025-09-05 08:18:24');
        });

        test('should format date-only timestamps', () => {
            const logWithDateOnly: LogObject = {
                caller: 'test.go:123',
                job_id: '',
                level: LogLevelEnum.INFO,
                msg: 'Test message',
                timestamp: '2025-09-04',
            };

            renderWithContext(
                <LogList
                    {...mockProps}
                    logs={[logWithDateOnly]}
                />,
            );

            const timestampElement = screen.getByTestId('timestamp');
            const formattedText = timestampElement.textContent;

            // Date-only strings don't match our timestamp pattern, so should be unchanged
            expect(formattedText).toBe('2025-09-04');
            expect(timestampElement).not.toHaveAttribute('title');
        });
    });
});
