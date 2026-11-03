// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import {fakeNow} from 'tests/helpers/date';
import {act, renderWithContext, userEvent, screen, waitFor, within} from 'tests/react_testing_utils';

import Logs from './logs';
import type {LogObjectWithAdditionalInfo} from './types';

// The real router history, in place of the global mock, so the URL the viewer writes can be read back
jest.mock('react-router-dom', () => jest.requireActual('react-router-dom'));

// The viewer mirrors its filters into the URL, which jsdom keeps from one test to the next
beforeEach(() => {
    window.history.replaceState(null, '', '/');
});

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

    let getLogs: jest.Mock;
    let rerenderWithLogs: (next: LogObjectWithAdditionalInfo[]) => void;

    function logsScreen(shown: LogObjectWithAdditionalInfo[]) {
        return (
            <Logs
                logs={shown}
                logNodes={[]}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs, getNewLogs: jest.fn(), getPlainLogs: jest.fn()}}
            />
        );
    }

    beforeEach(async () => {
        getLogs = jest.fn();

        // Mount server log screen
        const {rerender} = renderWithContext(logsScreen(logs));
        rerenderWithLogs = (next) => rerender(logsScreen(next));

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
        rerenderWithLogs([]);

        await waitFor(() => {
            expect(screen.getByText(/No logs match your filters/)).toBeInTheDocument();
        });

        const list = screen.getByRole('list', {name: 'Server log entries'});
        expect(list).toBeEmptyDOMElement();
    });

    test('should update the search input without waiting for the query', async () => {
        const searchInput = screen.getByLabelText('Search logs');
        await userEvent.type(searchInput, 'msg 1');

        // Typing is not gated on the debounced query
        expect(searchInput).toHaveValue('msg 1');
    });

    test('should apply a cleared search immediately', async () => {
        const searchInput = screen.getByLabelText('Search logs');
        await userEvent.type(searchInput, 'msg 1');
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({search: 'msg 1'})));

        await userEvent.click(screen.getByLabelText('Clear search'));

        expect(searchInput).toHaveValue('');
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({search: ''})));
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
            actions={{getLogs: jest.fn(), getNewLogs: jest.fn(), getPlainLogs: jest.fn()}}
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

    function renderLogs(getLogs: jest.Mock, getNewLogs: jest.Mock = jest.fn().mockResolvedValue({})) {
        return renderWithContext(
            <Logs
                logs={[]}
                logNodes={[]}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs, getNewLogs, getPlainLogs: jest.fn().mockResolvedValue({})}}
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

    function rangeTimeInput(bound: 'From' | 'To') {
        return within(screen.getByRole('group', {name: bound})).getByLabelText('Time');
    }

    async function typeRangeTime(bound: 'From' | 'To', time: string) {
        await userEvent.clear(rangeTimeInput(bound));
        await userEvent.type(rangeTimeInput(bound), time);
        await userEvent.tab();
    }

    test('should send both bounds of a custom range and show it in the duration field', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);

        await pickMenuItem('Open menu to select a time range', 'Custom range');

        // Defaults to the last hour, ending at the current minute
        expect(rangeTimeInput('From')).toHaveValue('11:00 AM');
        expect(rangeTimeInput('To')).toHaveValue('12:00 PM');
        expect(screen.getByText(/Times are in your timezone/)).toBeInTheDocument();

        await typeRangeTime('From', '11:12');
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        // The end covers its whole minute
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({
            dateFrom: '2026-10-20 11:12:00.000 +00:00',
            dateTo: '2026-10-20 12:00:59.999 +00:00',
        })));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect((screen.getByLabelText('Duration') as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('Oct 20, 11:12 AM – 12:00 PM');

        await pickMenuItem('Open menu to select a time range', 'All time');

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({dateFrom: '', dateTo: ''})));
    });

    test('should not apply a custom range that ends before it starts', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await typeRangeTime('To', '10:00');

        expect(screen.getByText('The start must be before the end.')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
        expect(getLogs).toHaveBeenCalledTimes(1);
    });

    test('should not let a custom range end in the future', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        renderLogs(jest.fn().mockResolvedValue({}));

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await typeRangeTime('To', '13:00');

        expect(rangeTimeInput('To')).toHaveValue('12:00 PM');
    });

    test('should let a custom range end in a minute that started after the dialog opened', async () => {
        // Moments before the next minute, so the dialog's clock ticks over soon
        fakeNow('2026-10-20T12:00:59.950Z');
        renderLogs(jest.fn().mockResolvedValue({}));

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        expect(rangeTimeInput('To')).toHaveValue('12:00 PM');

        jest.setSystemTime(new Date('2026-10-20T12:01:10Z'));
        await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
        await typeRangeTime('To', '12:01');

        expect(rangeTimeInput('To')).toHaveValue('12:01 PM');
    });

    test('should not apply a custom range while a time entry is invalid', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        renderLogs(jest.fn().mockResolvedValue({}));

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await typeRangeTime('From', 'soon');
        expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();

        await typeRangeTime('From', '11:30');
        expect(screen.getByRole('button', {name: 'Apply'})).toBeEnabled();

        await userEvent.clear(rangeTimeInput('To'));
        await userEvent.tab();
        expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
    });

    test('should not apply a custom range when Apply is clicked straight after typing an invalid time', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        const getLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await userEvent.clear(rangeTimeInput('To'));
        await userEvent.type(rangeTimeInput('To'), 'abc');

        // A browser blurs the time on mousedown and clicks on mouseup, with only microtasks in between.
        // Outside act, so React schedules work as it would there instead of flushing everything per event
        const actEnvironment = (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT;
        (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = false;
        try {
            rangeTimeInput('To').blur();
            await Promise.resolve();
            screen.getByRole('button', {name: 'Apply'}).click();
            await new Promise((resolve) => setTimeout(resolve, 50));
        } finally {
            (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = actEnvironment;
        }

        expect(screen.getByRole('dialog', {name: 'Custom time range'})).toBeInTheDocument();
        expect(rangeTimeInput('To')).toHaveClass('error');
        expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
        expect(getLogs).toHaveBeenCalledTimes(1);
    });

    test('should turn off live tail when a custom range is applied', async () => {
        fakeNow('2026-10-20T12:00:30Z');
        renderLogs(jest.fn().mockResolvedValue({}));

        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');
        expect(screen.getByLabelText('Live tail')).toHaveValue('Every 10 seconds');

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        expect(screen.getByLabelText('Live tail')).toHaveValue('Off');
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
        const getNewLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs, getNewLogs);
        await userEvent.type(screen.getByLabelText('Search logs'), 'websocket');
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));

        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');

        // Turning live tail on polls straight away
        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));
        expect(getNewLogs.mock.calls[0][0].search).toBe('websocket');
        expect(getLogs).toHaveBeenCalledTimes(2);
    });

    test('should not queue a live-tail poll behind a pending search', async () => {
        const search = deferred();
        const getLogs = jest.fn().mockResolvedValueOnce({}).mockReturnValueOnce(search.promise).mockResolvedValue({});
        const getNewLogs = jest.fn().mockResolvedValue({});
        renderLogs(getLogs, getNewLogs);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await userEvent.type(screen.getByLabelText('Search logs'), 'websocket');
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));

        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');
        search.resolve();
        await new Promise((r) => setTimeout(r, 0));

        expect(getLogs).toHaveBeenCalledTimes(2);
        expect(getNewLogs).not.toHaveBeenCalled();
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
                actions={{getLogs, getNewLogs: jest.fn().mockResolvedValue({}), getPlainLogs: jest.fn().mockResolvedValue({})}}
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
    });

    test('should show the truncation notice for a node that returned a full page', async () => {
        renderWithContext(
            <Logs
                logs={[nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]}
                logNodes={['node-a', 'node-b']}
                truncatedLogNodes={['node-b']}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs: jest.fn().mockResolvedValue({}), getNewLogs: jest.fn().mockResolvedValue({}), getPlainLogs: jest.fn().mockResolvedValue({})}}
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

describe('components/admin_console/server_logs/Logs live tail', () => {
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

    function timedLog(node: string, msg: string, timestamp: string): LogObjectWithAdditionalInfo {
        return {...nodeLog(node, msg), timestamp};
    }

    function renderLogs(logs: LogObjectWithAdditionalInfo[] = [], {getLogs = jest.fn().mockResolvedValue({}), getNewLogs = jest.fn().mockResolvedValue({})} = {}) {
        renderWithContext(
            <Logs
                logs={logs}
                logNodes={[...new Set(logs.map((log) => log[LogNodeKey]!))]}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={false}
                actions={{getLogs, getNewLogs, getPlainLogs: jest.fn().mockResolvedValue({})}}
            />,
        );
        return {getLogs, getNewLogs};
    }

    async function pickMenuItem(menuLabel: string, item: string, role: 'menuitemradio' | 'menuitemcheckbox' = 'menuitemradio') {
        await userEvent.click(screen.getByLabelText(menuLabel));
        await userEvent.click(screen.getByRole(role, {name: new RegExp(`^${item}`)}));
    }

    // Turning live tail on polls straight away
    async function poll() {
        await pickMenuItem('Open menu to turn live tail on or off', 'Off');
        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');
    }

    test('should ask every node in one request for what was logged since the full load started, with an overlap', async () => {
        fakeNow('2026-10-20T09:45:00.000Z');
        const {getLogs, getNewLogs} = renderLogs();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        jest.setSystemTime(new Date('2026-10-20T09:45:10.000Z'));
        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));
        expect(getNewLogs).toHaveBeenCalledWith({serverNames: [], logLevels: [], dateFrom: '2026-10-20 09:44:30.000 +00:00', dateTo: '', search: ''});
        expect(getLogs).toHaveBeenCalledTimes(1);
    });

    test('should ask from when the previous poll started on the next poll', async () => {
        fakeNow('2026-10-20T09:45:00.000Z');
        const {getLogs, getNewLogs} = renderLogs();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        jest.setSystemTime(new Date('2026-10-20T09:45:10.123Z'));
        await poll();
        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));

        jest.setSystemTime(new Date('2026-10-20T09:45:20.000Z'));
        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(2));
        expect(getNewLogs).toHaveBeenLastCalledWith(expect.objectContaining({dateFrom: '2026-10-20 09:44:40.123 +00:00'}));
    });

    test('should keep asking from the last successful fetch after a poll fails', async () => {
        fakeNow('2026-10-20T09:45:00.000Z');
        const getNewLogs = jest.fn().mockResolvedValueOnce({error: new Error('unreachable')}).mockResolvedValue({});
        const {getLogs} = renderLogs([], {getNewLogs});
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        jest.setSystemTime(new Date('2026-10-20T09:45:10.000Z'));
        await poll();
        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));

        jest.setSystemTime(new Date('2026-10-20T09:45:20.000Z'));
        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(2));
        expect(getNewLogs.mock.calls.map(([filter]) => filter.dateFrom)).toEqual([
            '2026-10-20 09:44:30.000 +00:00',
            '2026-10-20 09:44:30.000 +00:00',
        ]);
    });

    test('should ask for the whole time range while no fetch has succeeded', async () => {
        const {getLogs, getNewLogs} = renderLogs([], {getLogs: jest.fn().mockResolvedValue({error: new Error('unreachable')})});
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledWith({serverNames: [], logLevels: [], dateFrom: '', dateTo: '', search: ''}));
    });

    test('should not reach back past the start of the time range', async () => {
        fakeNow('2026-10-20T12:00:00.000Z');
        const {getLogs, getNewLogs} = renderLogs();
        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({dateFrom: '2026-10-20 11:55:00.000 +00:00'})));

        // The tab was hidden for a while, so the last fetch is older than the range
        jest.setSystemTime(new Date('2026-10-20T12:10:00.000Z'));
        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledWith(expect.objectContaining({dateFrom: '2026-10-20 12:05:00.000 +00:00'})));
    });

    test('should only ask the selected node, with the enabled levels', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({node: 'node-b', enabledLevels: ['error', 'warn']}));
        const {getLogs, getNewLogs} = renderLogs([timedLog('node-b', 'b1', '2026-10-20 09:40:01.000 Z')]);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        await poll();

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledWith(expect.objectContaining({serverNames: ['node-b'], logLevels: ['panic', 'fatal', 'critical', 'error', 'warn']})));
    });

    test('should drop entries that age out of the time range on a poll that brings nothing new', async () => {
        fakeNow('2026-10-20T09:44:00Z');
        const {getLogs, getNewLogs} = renderLogs([
            timedLog('node-a', 'older', '2026-10-20 09:40:00.000 Z'),
            timedLog('node-a', 'newer', '2026-10-20 09:43:00.000 Z'),
        ]);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        await pickMenuItem('Open menu to select a time range', 'Last 5 minutes');
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(screen.getByText('older')).toBeInTheDocument();

        jest.setSystemTime(new Date('2026-10-20T09:46:00Z'));
        await pickMenuItem('Open menu to turn live tail on or off', 'Every 10 seconds');

        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByText('older')).not.toBeInTheDocument());
        expect(screen.getByText('newer')).toBeInTheDocument();
    });

    test('should reload everything when a filter changes while live tail is on', async () => {
        const {getLogs, getNewLogs} = renderLogs();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        await poll();
        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));

        await pickMenuItem('Open menu to select which log levels to show', 'Debug', 'menuitemcheckbox');

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(getLogs).toHaveBeenLastCalledWith({serverNames: [], logLevels: ['panic', 'fatal', 'critical', 'error', 'warn', 'info', 'stdlog'], dateFrom: '', dateTo: '', search: ''});
    });

    test('should reload everything on a manual reload while live tail is on', async () => {
        const {getLogs, getNewLogs} = renderLogs();
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        await poll();
        await waitFor(() => expect(getNewLogs).toHaveBeenCalledTimes(1));

        await userEvent.click(screen.getByRole('button', {name: 'Reload'}));

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(2));
        expect(getNewLogs).toHaveBeenCalledTimes(1);
    });
});

describe('components/admin_console/server_logs/Logs URL filters', () => {
    const PAGE = '/admin_console/reporting/server_logs';
    const ERROR_AND_WARN = ['panic', 'fatal', 'critical', 'error', 'warn'];

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    function renderLogs(url: string, {getLogs = jest.fn().mockResolvedValue({}), isPlainLogs = false} = {}) {
        const history = createMemoryHistory({initialEntries: [url]});
        const getPlainLogs = jest.fn().mockResolvedValue({});
        renderWithContext(
            <Logs
                logs={[nodeLog('node-a', 'a'), nodeLog('node-b', 'b')]}
                logNodes={['node-a', 'node-b']}
                truncatedLogNodes={[]}
                plainLogs={[]}
                isPlainLogs={isPlainLogs}
                actions={{getLogs, getNewLogs: jest.fn().mockResolvedValue({}), getPlainLogs}}
            />,
            {},
            {history},
        );
        return {history, getLogs, getPlainLogs};
    }

    async function pickMenuItem(menuLabel: string, item: string, role: 'menuitemradio' | 'menuitemcheckbox' = 'menuitemradio') {
        await userEvent.click(screen.getByLabelText(menuLabel));
        await userEvent.click(screen.getByRole(role, {name: new RegExp(`^${item}`)}));
    }

    function urlParams(history: ReturnType<typeof createMemoryHistory>) {
        return Object.fromEntries(new URLSearchParams(history.location.search));
    }

    test('should load the filters from the URL and send them with the first query', async () => {
        fakeNow('2026-10-20T12:00:00Z');
        const {getLogs} = renderLogs(`${PAGE}?search=timeout&levels=error,warn&node=node-b&range=60`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs).toHaveBeenCalledWith({
            search: 'timeout',
            logLevels: ERROR_AND_WARN,
            serverNames: ['node-b'],
            dateFrom: '2026-10-20 11:00:00.000 +00:00',
            dateTo: '',
        });
        expect(screen.getByLabelText('Search logs')).toHaveValue('timeout');
        expect(screen.getByLabelText('Levels')).toHaveValue('2 selected');
        expect(screen.getByLabelText('Node')).toHaveValue('node-b');
        expect(screen.getByLabelText('Duration')).toHaveValue('Last hour');
    });

    test('should load a custom range from the URL', async () => {
        const {getLogs} = renderLogs(`${PAGE}?from=2026-10-20T11:12:00.000Z&to=2026-10-20T12:00:59.999Z`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({
            dateFrom: '2026-10-20 11:12:00.000 +00:00',
            dateTo: '2026-10-20 12:00:59.999 +00:00',
        }));
        expect((screen.getByLabelText('Duration') as HTMLInputElement).value.replace(/\s/g, ' ')).toBe('Oct 20, 11:12 AM – 12:00 PM');
    });

    test('should prefer the URL over saved prefs, and use the saved prefs the URL leaves out', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({node: 'node-a', enabledLevels: ['debug']}));
        const {getLogs} = renderLogs(`${PAGE}?levels=error,warn`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({logLevels: ERROR_AND_WARN, serverNames: ['node-a']}));
    });

    test('should remember the levels and node of an opened link as the last used ones', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({node: 'node-a', enabledLevels: ['debug']}));
        renderLogs(`${PAGE}?levels=error&node=node-b`);

        await waitFor(() => expect(JSON.parse(localStorage.getItem('mm_admin_logs_prefs')!)).toMatchObject({node: 'node-b', enabledLevels: ['error']}));
    });

    test('should open a link with filters in the structured viewer over a saved plain format', async () => {
        localStorage.setItem('mm_admin_logs_format', 'plain');
        const {getLogs, getPlainLogs} = renderLogs(`${PAGE}?search=timeout`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({search: 'timeout'})));
        expect(getPlainLogs).not.toHaveBeenCalled();
    });

    test('should ignore invalid values and drop them from the URL', async () => {
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({enabledLevels: ['debug']}));
        const {getLogs, history} = renderLogs(`${PAGE}?search=${'a'.repeat(257)}&levels=bogus,warn&range=7&from=2026-10-20T11:00:00Z&to=yesterday&tab=1`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs).toHaveBeenCalledWith({search: '', logLevels: ['warn'], serverNames: [], dateFrom: '', dateTo: ''});
        expect(screen.getByLabelText('Duration')).toHaveValue('All time');

        // Parameters that aren't filters are left alone
        await waitFor(() => expect(urlParams(history)).toEqual({levels: 'warn', tab: '1'}));
    });

    test.each([
        ['levels with no known level fall back to the saved ones', 'levels=bogus', {logLevels: ['panic', 'fatal', 'critical', 'error']}],
        ['a range that ends before it starts', 'from=2026-10-20T12:00:00Z&to=2026-10-20T11:00:00Z', {dateFrom: '', dateTo: ''}],
        ['a range that ends when it starts', 'from=2026-10-20T12:00:00Z&to=2026-10-20T12:00:00Z', {dateFrom: '', dateTo: ''}],
        ['dates without a timezone offset', 'from=2026-10-20T11:00:00&to=2026-10-20T12:00:00', {dateFrom: '', dateTo: ''}],
        ['dates that are not on the calendar', 'from=2026-02-30T11:00:00Z&to=2026-03-02T12:00:00Z', {dateFrom: '', dateTo: ''}],
        ['an invalid custom range in favor of a valid preset', 'range=60&from=bad&to=2026-10-20T12:00:00Z', {dateFrom: '2026-10-20 11:00:00.000 +00:00', dateTo: ''}],
    ])('should ignore %s', async (_, query, expected) => {
        fakeNow('2026-10-20T12:00:00Z');
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({enabledLevels: ['error']}));
        const {getLogs} = renderLogs(`${PAGE}?${query}`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));
        expect(getLogs).toHaveBeenCalledWith(expect.objectContaining(expected));
    });

    test('should keep a search of 256 characters that take two UTF-16 code units each', async () => {
        const search = '😀'.repeat(256);
        const {getLogs} = renderLogs(`${PAGE}?search=${encodeURIComponent(search)}`);

        await waitFor(() => expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({search})));
    });

    test('should mirror the filters in the URL as they change, without adding history entries', async () => {
        const {history} = renderLogs(PAGE);
        await screen.findByText('a');
        expect(history.location.search).toBe('');

        await pickMenuItem('Open menu to select which log levels to show', 'Debug', 'menuitemcheckbox');
        await pickMenuItem('Open menu to select which log levels to show', 'Info', 'menuitemcheckbox');
        await pickMenuItem('Open menu to select a node', 'node-b');
        await pickMenuItem('Open menu to select a time range', 'Last 15 minutes');

        await waitFor(() => expect(history.location.search).toBe('?levels=error,warn&node=node-b&range=15'));
        expect(history.length).toBe(1);

        await pickMenuItem('Open menu to select a time range', 'Custom range');
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
        await waitFor(() => expect(urlParams(history)).toEqual({
            levels: 'error,warn',
            node: 'node-b',
            from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
            to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:59\.999Z$/),
        }));

        await pickMenuItem('Open menu to select a time range', 'All time');
        await pickMenuItem('Open menu to select a node', 'All nodes');
        await userEvent.click(screen.getByLabelText('Open menu to select which log levels to show'));
        await userEvent.click(screen.getByRole('menuitem', {name: 'Select all levels'}));

        await waitFor(() => expect(history.location.search).toBe(''));
        expect(history.length).toBe(1);
    });

    test('should put the search in the URL once it is debounced, not on every keystroke', async () => {
        const {history, getLogs} = renderLogs(PAGE);
        const searches: string[] = [];
        history.listen((location) => searches.push(new URLSearchParams(location.search).get('search') ?? ''));

        await userEvent.type(screen.getByLabelText('Search logs'), 'WebSocket');

        await waitFor(() => expect(urlParams(history)).toEqual({search: 'WebSocket'}));
        expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({search: 'WebSocket'}));
        expect(searches).toEqual(['WebSocket']);
    });

    test('should take the filters out of the URL in the plain viewer and restore them in the structured one', async () => {
        const {history} = renderLogs(`${PAGE}?search=timeout`);
        await waitFor(() => expect(urlParams(history)).toEqual({search: 'timeout'}));

        await pickMenuItem('Open menu to select the log format', 'Plain text');
        await waitFor(() => expect(history.location.search).toBe(''));

        await pickMenuItem('Open menu to select the log format', 'Structured');
        await waitFor(() => expect(urlParams(history)).toEqual({search: 'timeout'}));
    });

    test('should apply the filters of a link followed while the viewer is open', async () => {
        fakeNow('2026-10-20T12:00:00Z');
        const {history, getLogs} = renderLogs(`${PAGE}?search=first&levels=warn&node=node-a&range=15`);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        act(() => history.push(`${PAGE}?search=second&node=node-b&range=60`));

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith({
            search: 'second',
            logLevels: ['warn'],
            serverNames: ['node-b'],
            dateFrom: '2026-10-20 11:00:00.000 +00:00',
            dateTo: '',
        }));
        expect(screen.getByLabelText('Search logs')).toHaveValue('second');
        expect(screen.getByLabelText('Duration')).toHaveValue('Last hour');

        // The levels the link leaves out are the last used ones, which were those of the previous link
        await waitFor(() => expect(urlParams(history)).toEqual({search: 'second', levels: 'warn', node: 'node-b', range: '60'}));
    });

    test('should apply the saved prefs when a link followed while the viewer is open has no filters', async () => {
        const {history, getLogs} = renderLogs(`${PAGE}?search=first&range=15`);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        act(() => history.push(PAGE));

        await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith({search: '', logLevels: [], serverNames: [], dateFrom: '', dateTo: ''}));
        expect(screen.getByLabelText('Search logs')).toHaveValue('');
        expect(history.location.search).toBe('');
    });

    test('should not query again when the viewer is left', async () => {
        const {history, getLogs} = renderLogs(`${PAGE}?search=first`);
        await waitFor(() => expect(getLogs).toHaveBeenCalledTimes(1));

        act(() => history.push('/admin_console/reporting/site_statistics'));

        expect(getLogs).toHaveBeenCalledTimes(1);
    });

    test('should keep the URL free of filters when the server only writes plain logs', async () => {
        const {history, getPlainLogs} = renderLogs(`${PAGE}?search=timeout`, {isPlainLogs: true});

        await waitFor(() => expect(getPlainLogs).toHaveBeenCalled());
        expect(history.location.search).toBe('');
    });
});
