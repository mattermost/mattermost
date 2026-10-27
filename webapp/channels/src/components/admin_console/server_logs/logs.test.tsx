// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import {renderWithContext, userEvent, screen, waitFor, within} from 'tests/react_testing_utils';

import Logs from './logs';
import type {LogObjectWithAdditionalInfo} from './types';

function nodeLog(node: string, msg: string): LogObjectWithAdditionalInfo {
    return {
        caller: '',
        job_id: '',
        level: LogLevelEnum.INFO,
        msg,
        timestamp: '2026-10-20 11:39:58.100 +02:00',
        worker: '',
        [LogNodeKey]: node,
    };
}

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
                logNodes={[]}
                truncatedLogNodes={[]}
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
            logNodes={[]}
            truncatedLogNodes={[]}
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
        expect(screen.getByText('second-request')).toBeInTheDocument();
        expect(screen.queryByText('first-request')).not.toBeInTheDocument();
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

describe('components/admin_console/server_logs/Logs fetching', () => {
    function deferred() {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => {
            resolve = r;
        });
        return {promise, resolve};
    }

    function renderLogs(getLogs: jest.Mock) {
        return renderWithContext(
            <Logs
                logs={[]}
                logNodes={[]}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs, getPlainLogs: jest.fn().mockResolvedValue({})}}
            />,
        );
    }

    async function pickMenuItem(menuLabel: string, item: string, role: 'menuitemradio' | 'menuitemcheckbox' = 'menuitemradio') {
        await userEvent.click(screen.getByLabelText(menuLabel));
        await userEvent.click(screen.getByRole(role, {name: new RegExp(`^${item}`)}));
    }

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // Fakes only the clock, so the promises and timers the tests wait on keep running
    function fakeNow(now: string) {
        jest.useFakeTimers({now: new Date(now), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'queueMicrotask', 'nextTick', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime']});
    }

    test('should send the enabled levels with the query', async () => {
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs.mock.calls[0][0].logLevels).toEqual([]);
        expect(getLogs.mock.calls[0][0].serverNames).toEqual([]);

        await pickMenuItem('Open menu to select which log levels to show', 'Debug', 'menuitemcheckbox');

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(getLogs.mock.calls[1][0].logLevels).toEqual(['panic', 'fatal', 'critical', 'error', 'warn', 'info', 'stdlog']);
    });

    test('should recompute the time preset when switching back to structured logs', async () => {
        fakeNow('2026-10-20T12:00:00Z');
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);

        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        await pickMenuItem('Open menu to select the log format', 'Plain text');
        jest.setSystemTime(new Date('2026-10-20T12:30:00Z'));
        await pickMenuItem('Open menu to select the log format', 'Structured');

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({
            dateFrom: '2026-10-20 12:25:00.000 +00:00',
            dateTo: '',
        })));
    });

    test('should clear the time range from the empty state', async () => {
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        expect(await screen.findByText(/No logs found/)).toBeInTheDocument();

        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        expect(await screen.findByText(/No logs match your filters/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({dateFrom: ''})));
        expect(await screen.findByText(/No logs found/)).toBeInTheDocument();
    });

    test('should not start a fetch until the previous one has finished', async () => {
        const first = deferred();
        const getLogs = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        expect(getLogs).toHaveBeenCalledTimes(1);

        first.resolve();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(getLogs.mock.calls[1][0].dateFrom).not.toBe('');
    });

    test('should send the search with the query', async () => {
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs.mock.calls[0][0].search).toBe('');

        await userEvent.type(screen.getByLabelText('Search logs'), 'WebSocket');

        // Debounced, so the whole term goes out in one query
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({search: 'WebSocket'})));
        expect(getLogs).toHaveBeenCalledTimes(2);
    });

    test('should send the search with a live-tail poll', async () => {
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        await userEvent.type(screen.getByLabelText('Search logs'), 'websocket');
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));

        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');

        // Turning live tail on polls straight away
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(3));
        expect(getLogs.mock.calls[2][0].search).toBe('websocket');
    });

    test('should not queue a live-tail poll behind a pending search', async () => {
        const search = deferred();
        const getLogs = jest.fn().mockResolvedValueOnce({}).mockReturnValueOnce(search.promise).mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await userEvent.type(screen.getByLabelText('Search logs'), 'websocket');
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));

        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');
        search.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(getLogs).toHaveBeenCalledTimes(2);
    });

    test('should skip a queued fetch that a newer one replaces', async () => {
        fakeNow('2026-10-20T12:00:00Z');
        const first = deferred();
        const getLogs = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        await pickMenuItem('Open menu to select a time range', 'Last hour');

        first.resolve();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(getLogs.mock.calls[1][0].dateFrom).toBe('2026-10-20 11:00:00.000 +00:00');
        await new Promise((r) => setTimeout(r, 0));
        expect(getLogs).toHaveBeenCalledTimes(2);
    });
});

describe('components/admin_console/server_logs/Logs nodes', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    function logsElement(logs: LogObjectWithAdditionalInfo[], getLogs: jest.Mock, logNodes = [...new Set(logs.map((log) => log[LogNodeKey]!))]) {
        return (
            <Logs
                logs={logs}
                logNodes={logNodes}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs, getPlainLogs: jest.fn().mockResolvedValue({})}}
            />
        );
    }

    function renderLogs(logs: LogObjectWithAdditionalInfo[], {getLogs = jest.fn().mockResolvedValue({}), logNodes}: {getLogs?: jest.Mock; logNodes?: string[]} = {}) {
        const result = renderWithContext(logsElement(logs, getLogs, logNodes));
        return {...result, getLogs, rerenderLogs: (next: LogObjectWithAdditionalInfo[]) => result.rerender(logsElement(next, getLogs))};
    }

    async function pickNode(name: string) {
        await userEvent.click(screen.getByLabelText('Open menu to select a node'));
        await userEvent.click(screen.getByRole('menuitemradio', {name}));
    }

    test('should not offer a node selector for a single node', async () => {
        renderLogs([nodeLog('default', 'a')]);

        expect(await screen.findByText('a')).toBeInTheDocument();
        expect(screen.queryByLabelText('Node')).not.toBeInTheDocument();
        expect(document.querySelector('.LogRow__node')).toBeNull();

        await userEvent.type(screen.getByLabelText('Search logs'), 'default');
        await waitFor(() => expect(document.querySelectorAll('.LogRow')).toHaveLength(0));
    });

    // The server returns a node whose name matches unsearched, and the client search narrows it
    test('should send a search for a node name and show that node\'s entries', async () => {
        const {getLogs} = renderLogs([nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]);

        await userEvent.type(screen.getByLabelText('Search logs'), 'NODE-B');

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({search: 'NODE-B'})));
        expect(screen.queryByText('a')).not.toBeInTheDocument();
        expect(screen.getByText('b')).toBeInTheDocument();
    });

    test('should show the truncation notice for a node that returned a full page', async () => {
        renderWithContext(
            <Logs
                logs={[nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]}
                logNodes={['node-a', 'node-b']}
                truncatedLogNodes={['node-b']}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs: jest.fn().mockResolvedValue({}), getPlainLogs: jest.fn().mockResolvedValue({})}}
            />,
        );

        expect(await screen.findByText('Only the latest 10,000 entries from each node are shown')).toBeInTheDocument();
    });

    test('should send the picked node with the query', async () => {
        const {getLogs} = renderLogs([nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs.mock.calls[0][0].serverNames).toEqual([]);

        await pickNode('node-b');
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({serverNames: ['node-b']})));
        expect(screen.getByLabelText('Node')).toHaveValue('node-b');

        await pickNode('All nodes');
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({serverNames: []})));
        expect(screen.getByLabelText('Node')).toHaveValue('All nodes');
    });

    test('should narrow the shown entries to the picked node before its fetch returns', async () => {
        const {getLogs} = renderLogs([nodeLog('node-a', 'a'), nodeLog('node-b', 'b')], {getLogs: jest.fn().mockReturnValueOnce(Promise.resolve({})).mockReturnValue(new Promise(() => {}))});
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await pickNode('node-b');

        await waitFor(() => expect(screen.queryByText('a')).not.toBeInTheDocument());
        expect(screen.getByText('b')).toBeInTheDocument();
    });

    test('should keep every node known after a fetch returns only the selected node', async () => {
        const {rerenderLogs} = renderLogs([nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]);

        await pickNode('node-b');
        rerenderLogs([nodeLog('node-b', 'b')]);

        await userEvent.click(screen.getByLabelText('Open menu to select a node'));
        expect(screen.getByRole('menuitemradio', {name: 'node-a'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'node-b'})).toBeInTheDocument();
        expect(document.querySelector('.LogRow__node')).toHaveTextContent('node-b');
    });

    test('should add a node that only appears in a later response', async () => {
        const {rerenderLogs} = renderLogs([nodeLog('node-a', 'a')]);
        expect(screen.queryByLabelText('Node')).not.toBeInTheDocument();

        rerenderLogs([nodeLog('node-a', 'a'), nodeLog('node-c', 'c')]);

        await userEvent.click(await screen.findByLabelText('Open menu to select a node'));
        expect(screen.getByRole('menuitemradio', {name: 'node-a'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'node-c'})).toBeInTheDocument();
    });

    test('should list a node that returned no entries', async () => {
        renderLogs([nodeLog('node-a', 'a')], {logNodes: ['node-a', 'node-b']});

        await userEvent.click(await screen.findByLabelText('Open menu to select a node'));
        expect(screen.getByRole('menuitemradio', {name: 'node-a'})).toBeInTheDocument();
        expect(screen.getByRole('menuitemradio', {name: 'node-b'})).toBeInTheDocument();
    });

    test('should list the nodes in name order', async () => {
        renderLogs([nodeLog('node-c', 'c'), nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]);

        await userEvent.click(screen.getByLabelText('Open menu to select a node'));
        const nodeItems = within(screen.getByRole('menu', {name: 'Node menu'})).getAllByRole('menuitemradio');
        expect(nodeItems.map((item) => item.textContent)).toEqual(['All nodes', 'node-a', 'node-b', 'node-c']);
    });

    test('should restore the stored node and send it with the first query', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({node: 'node-b'}));
        const {getLogs} = renderLogs([]);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs.mock.calls[0][0].serverNames).toEqual(['node-b']);
        expect(screen.getByLabelText('Node')).toHaveValue('node-b');
    });

    test('should send all nodes for prefs saved before the node existed', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({pageSize: 50, wrapText: true, enabledLevels: ['error'], sortAsc: true}));
        const {getLogs} = renderLogs([]);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs.mock.calls[0][0].serverNames).toEqual([]);
        expect(getLogs.mock.calls[0][0].logLevels).toEqual(['panic', 'fatal', 'critical', 'error']);
    });

    test('should let a restored node that never returns be switched back to all nodes', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({node: 'gone'}));
        const {getLogs} = renderLogs([nodeLog('node-a', 'a')]);

        await pickNode('All nodes');

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({serverNames: []})));
    });

    test('should remember the picked node', async () => {
        renderLogs([nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]);

        await pickNode('node-b');

        await waitFor(() => expect(JSON.parse(localStorage.getItem('mm_admin_logs_prefs')!).node).toBe('node-b'));
    });
});
