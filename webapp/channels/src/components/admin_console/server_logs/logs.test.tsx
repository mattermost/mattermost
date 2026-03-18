// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {renderWithContext, userEvent, screen, waitFor} from 'tests/react_testing_utils';

import Logs from './logs';

describe('components/admin_console/server_logs/Logs', () => {
    // Log dataset
    const logs = [{
        caller: 'caller 1',
        job_id: 'job_id 1',
        level: LogLevelEnum.INFO,
        msg: 'msg 1',
        timestamp: 'timestamp 1',
        worker: 'worker 1',
        whatever: 'whatever 1',
    }, {
        caller: 'caller 2',
        job_id: 'job_id 2',
        level: LogLevelEnum.INFO,
        msg: 'msg 2',
        timestamp: 'timestamp 2',
        worker: 'worker 2',
        whatever: 'whatever 2',
    }, {
        caller: 'filtered',
        job_id: 'filtered',
        level: LogLevelEnum.INFO,
        msg: 'filtered message',
        timestamp: 'filtered',
        worker: 'filtered',
        whatever: 'filtered',
    }];

    beforeEach(async () => {
        // Mount server log screen
        renderWithContext(
            <Logs
                logs={logs}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs: jest.fn(), getPlainLogs: jest.fn()}}
            />,
        );

        // Wait for the logs to be displayed
        await waitFor(() => {
            expect(screen.queryByText('msg 1')).toBeInTheDocument();
            expect(screen.queryByText('msg 2')).toBeInTheDocument();
            expect(screen.queryByText('filtered message')).toBeInTheDocument();
        });
    });

    test('should display the logs correctly after loading', () => {
        expect(screen.getByText('msg 1')).toBeInTheDocument();
        expect(screen.getByText('msg 2')).toBeInTheDocument();
        expect(screen.getByText('filtered message')).toBeInTheDocument();
        expect(screen.getByText('caller 1')).toBeInTheDocument();
        expect(screen.getByText('caller 2')).toBeInTheDocument();
    });

    test('should show level filter toggles', () => {
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByText('Warn')).toBeInTheDocument();
        expect(screen.getByText('Info')).toBeInTheDocument();
        expect(screen.getByText('Debug')).toBeInTheDocument();
    });

    test.each(['caller', 'msg', 'worker', 'job_id', 'whatever'])('should search input be performed on %s attribute',
        async (searchString: string) => {
            const searchInput = screen.getByPlaceholderText('Search logs...');
            await userEvent.type(searchInput, searchString);

            // Use container text check since search highlights split text across <mark> elements
            await waitFor(() => {
                const logRows = document.querySelectorAll('.LogRow');
                const rowTexts = Array.from(logRows).map((r) => r.textContent || '');
                expect(rowTexts.some((t) => t.includes('msg 1'))).toBe(true);
                expect(rowTexts.some((t) => t.includes('msg 2'))).toBe(true);
                expect(rowTexts.some((t) => t.includes('filtered message'))).toBe(false);
            });
        });

    test.each(['level', 'timestamp'])('should search input not be performed on %s attribute',
        async (searchString: string) => {
            const searchInput = screen.getByPlaceholderText('Search logs...');
            await userEvent.type(searchInput, searchString);

            await waitFor(() => {
                const logRows = document.querySelectorAll('.LogRow');
                expect(logRows.length).toBe(0);
            });
        });

    test('should display live tail toggle', () => {
        expect(screen.getByText('Live')).toBeInTheDocument();
    });

    test('should display time range presets', () => {
        expect(screen.getByText('5m')).toBeInTheDocument();
        expect(screen.getByText('15m')).toBeInTheDocument();
        expect(screen.getByText('1h')).toBeInTheDocument();
        expect(screen.getByText('24h')).toBeInTheDocument();
    });
});
