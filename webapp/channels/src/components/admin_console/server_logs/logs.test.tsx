// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {renderWithContext, userEvent, screen, waitFor, within} from 'tests/react_testing_utils';

import Logs from './logs';
import type {LogObjectWithAdditionalInfo} from './types';

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

    test('should offer every level in the level filter menu', async () => {
        await userEvent.click(screen.getByLabelText('Open menu to select which log levels to show'));

        expect(screen.getByRole('menuitemcheckbox', {name: /^Error/})).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', {name: /^Warn/})).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', {name: /^Info/})).toBeInTheDocument();
        expect(screen.getByRole('menuitemcheckbox', {name: /^Debug/})).toBeInTheDocument();
    });

    test.each(['caller', 'msg', 'worker', 'job_id', 'whatever'])('should search input be performed on %s attribute',
        async (searchString: string) => {
            const searchInput = screen.getByLabelText('Search logs');
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
            const searchInput = screen.getByLabelText('Search logs');
            await userEvent.type(searchInput, searchString);

            await waitFor(() => {
                const logRows = document.querySelectorAll('.LogRow');
                expect(logRows.length).toBe(0);
            });
        });

    test('should expose the log rows as a list that only owns list items', () => {
        const list = screen.getByRole('list', {name: 'Server log entries'});

        expect(list).toHaveClass('LogViewer__list');
        expect(within(list).getAllByRole('listitem')).toHaveLength(3);

        // A list must not own anything other than list items
        expect(within(list).getAllByRole('listitem')).toEqual(Array.from(list.children));
    });

    test('should keep the empty state outside the list', async () => {
        const searchInput = screen.getByLabelText('Search logs');
        await userEvent.type(searchInput, 'nothing matches this');

        await waitFor(() => {
            expect(screen.getByText(/No logs match your filters/)).toBeInTheDocument();
        });

        const list = screen.getByRole('list', {name: 'Server log entries'});
        expect(list).toBeEmptyDOMElement();
    });

    test('should update the search input without waiting for the filtering', async () => {
        const searchInput = screen.getByLabelText('Search logs');
        await userEvent.type(searchInput, 'msg 1');

        // Typing is not gated on the debounced filter pass
        expect(searchInput).toHaveValue('msg 1');

        await waitFor(() => {
            expect(document.querySelectorAll('.LogRow')).toHaveLength(1);
        });
    });

    test('should apply a cleared search immediately', async () => {
        const searchInput = screen.getByLabelText('Search logs');
        await userEvent.type(searchInput, 'msg 1');

        await waitFor(() => {
            expect(document.querySelectorAll('.LogRow')).toHaveLength(1);
        });

        await userEvent.click(screen.getByLabelText('Clear search'));

        expect(searchInput).toHaveValue('');
        await waitFor(() => {
            expect(document.querySelectorAll('.LogRow')).toHaveLength(3);
        });
    });

    test('should default the live tail selector to off', () => {
        expect(screen.getByLabelText('Live tail')).toHaveValue('Off');
    });

    test('should offer every time range in the duration menu', async () => {
        await userEvent.click(screen.getByLabelText('Open menu to select a time range'));

        expect(screen.getByRole('menuitemradio', {name: 'All time'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Last 5 minutes'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Last 15 minutes'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Last hour'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Last 24 hours'})).toBeInTheDocument();
    });

    test('should offer both log formats in the format menu', async () => {
        expect(screen.getByLabelText('Log format')).toHaveValue('Structured');

        await userEvent.click(screen.getByLabelText('Open menu to select the log format'));

        expect(screen.getByRole('menuitemradio', {name: 'Structured'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'Plain text'})).toBeInTheDocument();
    });
});

describe('components/admin_console/server_logs/Logs refetching', () => {
    const logs = [{
        caller: 'caller 1',
        job_id: 'job_id 1',
        level: LogLevelEnum.INFO,
        msg: 'msg 1',
        timestamp: 'timestamp 1',
        worker: 'worker 1',
    }, {
        caller: 'caller 2',
        job_id: 'job_id 2',
        level: LogLevelEnum.INFO,
        msg: 'msg 2',
        timestamp: 'timestamp 2',
        worker: 'worker 2',
    }];

    const renderLogs = (logsProp: LogObjectWithAdditionalInfo[]) => (
        <Logs
            logs={logsProp}
            plainLogs={[]}
            isPlainLogs={false}
            actions={{getLogs: jest.fn(), getPlainLogs: jest.fn()}}
        />
    );

    test('should keep the expanded row expanded when the logs are refetched', async () => {
        const {rerender} = renderWithContext(renderLogs(logs));

        await userEvent.click(await screen.findByText('msg 2'));
        expect(document.querySelector('.LogRow__details')).toBeInTheDocument();

        // A reload or a live-tail poll hands down a new array of equal entries
        rerender(renderLogs(logs.map((log) => ({...log}))));

        expect(document.querySelector('.LogRow__details')).toBeInTheDocument();
    });

    test('should expand only the clicked row when entries share a timestamp, caller and message', async () => {
        // Concurrent requests log the same message from the same caller inside the
        // same millisecond, differing only in the fields further down the entry
        const shared = {
            caller: 'web/handlers.go:184',
            job_id: '',
            level: LogLevelEnum.DEBUG,
            msg: 'Received HTTP request',
            timestamp: '2026-08-13 13:02:17.904 +02:00',
            worker: '',
        };
        const concurrent = [
            {...shared, request_id: 'first-request'},
            {...shared, request_id: 'second-request'},
        ];

        renderWithContext(renderLogs(concurrent));

        await userEvent.click((await screen.findAllByText('Received HTTP request'))[0]);

        expect(document.querySelectorAll('.LogRow__details')).toHaveLength(1);
        expect(screen.getByText('first-request')).toBeInTheDocument();
        expect(screen.queryByText('second-request')).not.toBeInTheDocument();
    });

    test('should expand only the clicked row when entries are identical', async () => {
        const duplicate = {
            caller: 'web/handlers.go:184',
            job_id: '',
            level: LogLevelEnum.DEBUG,
            msg: 'Received HTTP request',
            timestamp: '2026-08-13 13:02:17.904 +02:00',
            worker: '',
        };

        renderWithContext(renderLogs([{...duplicate}, {...duplicate}]));

        await userEvent.click((await screen.findAllByText('Received HTTP request'))[1]);

        // The entries are indistinguishable by content, so only their position
        // shows that the clicked row is the one that expanded
        const rows = screen.getAllByRole('listitem');
        expect(rows[0].querySelector('.LogRow__details')).toBeNull();
        expect(rows[1].querySelector('.LogRow__details')).toBeInTheDocument();
    });
});
