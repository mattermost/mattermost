// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';

import {renderWithContext, fireEvent, screen, waitFor, within} from 'tests/react_testing_utils';

import LogList, {loadPrefs} from './log_list';
import type {LogObjectWithAdditionalInfo} from './types';

const PREFS_KEY = 'mm_admin_logs_prefs';

function makeLog(msg: string, timestamp: string, level = LogLevelEnum.INFO): LogObjectWithAdditionalInfo {
    return {
        caller: `caller ${msg}`,
        job_id: `job_id ${msg}`,
        level,
        msg,
        timestamp,
        worker: `worker ${msg}`,
    };
}

function makeNodeLog(node: string, msg: string, timestamp = '2026-03-12T10:00:01.000Z', level = LogLevelEnum.INFO): LogObjectWithAdditionalInfo {
    return {...makeLog(msg, timestamp, level), [LogNodeKey]: node};
}

function makeFailedNodeLog(node: string, timestamp = '2026-03-12 10:00:02.000 +00:00'): LogObjectWithAdditionalInfo {
    return {
        timestamp,
        level: LogLevelEnum.ERROR,
        msg: 'Failed to fetch logs from node',
        error: 'connection refused',
        failed_node: true,
        [LogNodeKey]: node,
    } as unknown as LogObjectWithAdditionalInfo;
}

// Entries one second apart, oldest first, so the sort order is unambiguous
function makeLogs(count: number, level = LogLevelEnum.INFO): LogObjectWithAdditionalInfo[] {
    return Array.from({length: count}, (_, i) => makeLog(
        `msg ${i + 1}`,
        new Date(Date.UTC(2026, 2, 12, 10, 0, i)).toISOString(),
        level,
    ));
}

const baseProps = {
    loading: false,
    truncatedNodes: [] as string[],
    onSearchChange: jest.fn(),
    search: '',
    onReload: jest.fn(),
    downloadUrl: '',
    liveTailEnabled: false,
    onToggleLiveTail: jest.fn(),
    pollInterval: 5000,
    onPollIntervalChange: jest.fn(),
    pollIntervals: [5000],
    pollIntervalLabels: {5000: {id: 'test.pollInterval.5s', defaultMessage: 'Every 5 seconds'}},
    timePresets: [],
    activeTimePreset: null,
    onTimePreset: jest.fn(),
    onClearTimePreset: jest.fn(),
    nodes: [] as string[],
    selectedNode: '',
    onSelectedNodeChange: jest.fn(),
};

// Holds the levels the way Logs does, since LogList only renders them
function StatefulLogList(props: Omit<React.ComponentProps<typeof LogList>, 'enabledLevels' | 'onEnabledLevelsChange'>) {
    const [enabledLevels, setEnabledLevels] = useState(() => new Set(loadPrefs().enabledLevels));
    return (
        <LogList
            {...props}
            enabledLevels={enabledLevels}
            onEnabledLevelsChange={setEnabledLevels}
        />
    );
}

function renderList(logs: LogObjectWithAdditionalInfo[]) {
    return renderWithContext(
        <StatefulLogList
            {...baseProps}
            logs={logs}
        />,
    );
}

type ListProps = Omit<React.ComponentProps<typeof LogList>, 'enabledLevels' | 'onEnabledLevelsChange'>;

function renderListWith(props: Partial<ListProps>) {
    return renderWithContext(
        <StatefulLogList
            {...baseProps}
            logs={[]}
            {...props}
        />,
    );
}

function pressKey(key: string) {
    fireEvent.keyDown(screen.getByRole('list'), {key});
}

function pressArrow(direction: 'ArrowDown' | 'ArrowUp', times = 1) {
    for (let i = 0; i < times; i++) {
        pressKey(direction);
    }
}

function focusedRow(): Element | null {
    return document.querySelector('.LogRow--focused');
}

function focusedRowMessage(): string | undefined {
    return focusedRow()?.querySelector('.LogRow__message')?.textContent ?? undefined;
}

function rowNodes(): string[] {
    return Array.from(document.querySelectorAll('.LogRow__node')).map((el) => el.textContent ?? '');
}

function openNodeMenu() {
    fireEvent.click(screen.getByLabelText('Open menu to select a node'));
}

function rowMessages(): string[] {
    return Array.from(document.querySelectorAll('.LogRow__message')).map((el) => el.textContent ?? '');
}

function openLevelsMenu() {
    fireEvent.click(screen.getByLabelText('Open menu to select which log levels to show'));
}

function levelMenuItem(label: string): HTMLElement {
    return screen.getByRole('menuitemcheckbox', {name: new RegExp(`^${label}`)});
}

function storedPrefs() {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
}

// Pins the sort order to ascending for suites whose tests don't depend on
// sort direction, so their expectations stay readable regardless of the
// current default.
function pinAscendingSort(extraPrefs: Record<string, unknown> = {}) {
    localStorage.setItem(PREFS_KEY, JSON.stringify({sortAsc: true, ...extraPrefs}));
}

describe('components/admin_console/server_logs/LogList', () => {
    beforeEach(() => {
        localStorage.clear();

        // Not implemented by jsdom
        Element.prototype.scrollIntoView = jest.fn();
        Element.prototype.scrollTo = jest.fn();
    });

    const first = makeLog('msg 1', '2026-03-12T10:00:01.000Z');
    const second = makeLog('msg 2', '2026-03-12T10:00:02.000Z');
    const third = makeLog('msg 3', '2026-03-12T10:00:03.000Z');

    describe('selection', () => {
        beforeEach(pinAscendingSort);

        test('should move the selection with the arrow keys', () => {
            renderList([first, second, third]);

            pressArrow('ArrowDown', 2);
            expect(focusedRowMessage()).toBe('msg 2');
            expect(document.activeElement).toBe(focusedRow()?.querySelector('.LogRow__main'));

            pressArrow('ArrowUp');
            expect(focusedRowMessage()).toBe('msg 1');
        });

        test('should keep the selection on the same entry when new logs arrive', () => {
            const {rerender} = renderList([first, second, third]);

            pressArrow('ArrowDown', 3);
            expect(focusedRowMessage()).toBe('msg 3');

            // A poll delivers an older entry, so every row below it shifts down a position
            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={[makeLog('msg 0', '2026-03-12T10:00:00.000Z'), first, second, third]}
                />,
            );

            expect(focusedRowMessage()).toBe('msg 3');
        });

        test('should keep the selection on the same entry when older logs age out', () => {
            const {rerender} = renderList([first, second, third]);

            pressArrow('ArrowDown', 2);
            expect(focusedRowMessage()).toBe('msg 2');

            // A poll with an active time preset drops the oldest entry off the front
            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={[second, third]}
                />,
            );

            expect(focusedRowMessage()).toBe('msg 2');
            expect(document.activeElement).toBe(focusedRow()?.querySelector('.LogRow__main'));
        });

        test('should keep the selection on the same entry when newest entries sort first', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({sortAsc: false}));

            const {rerender} = renderList([first, second, third]);

            // Newest first, so the second row is the middle entry
            pressArrow('ArrowDown', 2);
            expect(focusedRowMessage()).toBe('msg 2');

            // A live-tail poll adds a newer entry, which lands above the selection
            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={[first, second, third, makeLog('msg 4', '2026-03-12T10:00:04.000Z')]}
                />,
            );

            expect(focusedRowMessage()).toBe('msg 2');
        });

        test('should drop the selection when the selected entry is gone', () => {
            const {rerender} = renderList([first, second, third]);

            pressArrow('ArrowDown');
            expect(focusedRowMessage()).toBe('msg 1');

            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={[second, third]}
                />,
            );

            expect(focusedRow()).toBeNull();
        });
    });

    describe('level filters', () => {
        beforeEach(pinAscendingSort);

        const mixedLevels = [
            makeLog('an error', '2026-03-12T10:00:01.000Z', LogLevelEnum.ERROR),
            makeLog('a warning', '2026-03-12T10:00:02.000Z', LogLevelEnum.WARN),
            makeLog('some info', '2026-03-12T10:00:03.000Z', LogLevelEnum.INFO),
            makeLog('a debug line', '2026-03-12T10:00:04.000Z', LogLevelEnum.DEBUG),
        ];

        test('should show a count of the entries per level', () => {
            renderList(mixedLevels);
            openLevelsMenu();

            expect(levelMenuItem('Error')).toHaveTextContent('Error1');
            expect(levelMenuItem('Debug')).toHaveTextContent('Debug1');
        });

        test('should hide and restore a level when it is unchecked', () => {
            renderList(mixedLevels);
            openLevelsMenu();

            fireEvent.click(levelMenuItem('Debug'));
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info']);

            fireEvent.click(levelMenuItem('Debug'));
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
        });

        test('should keep the last enabled level on, so the list cannot filter itself empty', () => {
            renderList(mixedLevels);
            openLevelsMenu();

            fireEvent.click(levelMenuItem('Error'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['an error']);

            fireEvent.click(levelMenuItem('Error'));
            expect(rowMessages()).toEqual(['an error']);
        });

        test('should solo a level on ctrl-click and restore every level on a second ctrl-click', () => {
            renderList(mixedLevels);
            openLevelsMenu();

            fireEvent.click(levelMenuItem('Warn'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['a warning']);

            fireEvent.click(levelMenuItem('Warn'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
        });

        test('should re-enable every level from the select all item', async () => {
            renderList(mixedLevels);
            openLevelsMenu();

            fireEvent.click(levelMenuItem('Info'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['some info']);

            fireEvent.click(screen.getByRole('menuitem', {name: 'Select all levels'}));

            // Selecting all levels closes the menu, which defers the handler
            // until the close animation has finished
            await waitFor(() => {
                expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
            });
        });
    });

    describe('footer', () => {
        // The server searches too, so the loaded entries are no longer a meaningful total
        test('should count the matching entries while searching', () => {
            renderWithContext(
                <StatefulLogList
                    {...baseProps}
                    logs={[first, second, third]}
                    search='msg 2'
                />,
            );

            expect(rowMessages()).toEqual(['msg 2']);
            expect(screen.getByText(/of 1 entries matching your filters$/)).toBeInTheDocument();
        });
    });

    describe('searching', () => {
        test('should keep the list in place rather than show the spinner while a search loads', () => {
            renderListWith({logs: [], loading: true, search: 'missing'});

            expect(screen.queryByText('Loading logs')).not.toBeInTheDocument();
            expect(screen.getByText('Refreshing…')).toBeInTheDocument();
            expect(screen.queryByText(/No logs match your filters/)).not.toBeInTheDocument();
        });

        test('should show the spinner while the first load has no entries', () => {
            renderListWith({logs: [], loading: true});

            expect(screen.getByText('Loading logs')).toBeInTheDocument();
        });
    });

    describe('truncation notice', () => {
        test('should not show the notice when every node returned less than the limit', () => {
            renderListWith({logs: [first]});

            expect(screen.queryByText(/Only the latest/)).not.toBeInTheDocument();
        });

        test('should show the limit when the server returned a full page', () => {
            renderListWith({logs: [makeNodeLog('default', 'a')], nodes: ['default'], truncatedNodes: ['default']});

            expect(screen.getByText('Only the latest 10,000 entries are shown')).toBeInTheDocument();
            expect(screen.getByText(/Download the log file to see them/)).toBeInTheDocument();
        });

        test('should name the limit per node when several nodes are listed', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'a'), makeNodeLog('node-b', 'b')],
                nodes: ['node-a', 'node-b'],
                truncatedNodes: ['node-b'],
            });

            expect(screen.getByText('Only the latest 10,000 entries from each node are shown')).toBeInTheDocument();
        });

        test('should only show the notice for the selected node', () => {
            const props = {logs: [makeNodeLog('node-a', 'a'), makeNodeLog('node-b', 'b')], nodes: ['node-a', 'node-b'], truncatedNodes: ['node-b']};

            const {rerender} = renderListWith({...props, selectedNode: 'node-a'});
            expect(screen.queryByText(/Only the latest/)).not.toBeInTheDocument();

            rerender(
                <StatefulLogList
                    {...baseProps}
                    {...props}
                    selectedNode='node-b'
                />,
            );
            expect(screen.getByText(/Only the latest/)).toBeInTheDocument();
        });
    });

    describe('sorting', () => {
        test('should default to showing the newest entries first', () => {
            renderList([first, second, third]);

            expect(rowMessages()).toEqual(['msg 3', 'msg 2', 'msg 1']);
        });

        test('should reverse the rows when the time header is clicked', () => {
            renderList([first, second, third]);

            expect(rowMessages()).toEqual(['msg 3', 'msg 2', 'msg 1']);

            fireEvent.click(screen.getByRole('button', {name: /^Time/}));
            expect(rowMessages()).toEqual(['msg 1', 'msg 2', 'msg 3']);
        });

        test('should keep entries with the same timestamp in reverse file order when newest first', () => {
            renderList([
                makeLog('starting', '2026-10-20 11:39:58.781 +02:00'),
                makeLog('listening', '2026-10-20 11:39:58.781 +02:00'),
                makeLog('later', '2026-10-20 11:39:58.782 +02:00'),
            ]);

            expect(rowMessages()).toEqual(['later', 'listening', 'starting']);

            fireEvent.click(screen.getByRole('button', {name: /^Time/}));
            expect(rowMessages()).toEqual(['starting', 'listening', 'later']);
        });

        test('should interleave entries from different cluster nodes by timestamp', () => {
            renderList([
                makeLog('node1 a', '2026-10-20 11:39:58.100 +02:00'),
                makeLog('node1 b', '2026-10-20 11:39:58.300 +02:00'),
                makeLog('node2 a', '2026-10-20 09:39:58.200 Z'),
            ]);

            expect(rowMessages()).toEqual(['node1 b', 'node2 a', 'node1 a']);
        });
    });

    describe('pagination', () => {
        beforeEach(() => pinAscendingSort({pageSize: 50}));

        function footerInfo(): string {
            return document.querySelector('.LogViewer__footer-info')?.textContent ?? '';
        }

        function pageIndicator(): string {
            return document.querySelector('.LogViewer__page-indicator')?.textContent ?? '';
        }

        test('should page through the logs with the previous and next buttons', () => {
            renderList(makeLogs(60));

            expect(rowMessages()).toHaveLength(50);
            expect(rowMessages()[0]).toBe('msg 1');
            expect(footerInfo()).toContain('Showing 1 - 50 of 60');
            expect(pageIndicator()).toBe('Page 1 of 2');
            expect(screen.getByLabelText('Previous page')).toBeDisabled();

            fireEvent.click(screen.getByLabelText('Next page'));
            expect(rowMessages()).toEqual(['msg 51', 'msg 52', 'msg 53', 'msg 54', 'msg 55', 'msg 56', 'msg 57', 'msg 58', 'msg 59', 'msg 60']);
            expect(footerInfo()).toContain('Showing 51 - 60 of 60');
            expect(screen.getByLabelText('Next page')).toBeDisabled();

            fireEvent.click(screen.getByLabelText('Previous page'));
            expect(rowMessages()[0]).toBe('msg 1');
            expect(pageIndicator()).toBe('Page 1 of 2');
        });

        test('should show more rows when the page size grows', () => {
            renderList(makeLogs(60));

            expect(rowMessages()).toHaveLength(50);

            fireEvent.change(screen.getByLabelText('Show'), {target: {value: '100'}});
            expect(rowMessages()).toHaveLength(60);
            expect(pageIndicator()).toBe('Page 1 of 1');
        });

        test('should clamp the page when the logs no longer fill it', () => {
            const {rerender} = renderList(makeLogs(60));

            fireEvent.click(screen.getByLabelText('Next page'));
            expect(pageIndicator()).toBe('Page 2 of 2');

            // A poll returns fewer entries than the current page starts at
            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={makeLogs(30)}
                />,
            );

            expect(pageIndicator()).toBe('Page 1 of 1');
            expect(rowMessages()).toHaveLength(30);
        });
    });

    describe('stored preferences', () => {
        test('should restore the stored preferences on mount', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({
                pageSize: 50,
                wrapText: false,
                enabledLevels: ['error'],
                sortAsc: false,
            }));

            renderList([
                makeLog('an error', '2026-03-12T10:00:01.000Z', LogLevelEnum.ERROR),
                makeLog('a later error', '2026-03-12T10:00:02.000Z', LogLevelEnum.ERROR),
                makeLog('some info', '2026-03-12T10:00:03.000Z', LogLevelEnum.INFO),
            ]);

            expect(rowMessages()).toEqual(['a later error', 'an error']);
            expect(screen.getByLabelText('Show')).toHaveValue('50');
            expect(screen.getByRole('button', {name: 'Wrap text'})).toHaveAttribute('aria-pressed', 'false');
        });

        test('should save a preference change', () => {
            renderList([first]);

            fireEvent.click(screen.getByRole('button', {name: 'Wrap text'}));

            expect(storedPrefs()).toEqual({
                pageSize: 200,
                wrapText: false,
                enabledLevels: ['error', 'warn', 'info', 'debug'],
                sortAsc: false,
                node: '',
            });
        });

        test('should fall back to the defaults when the stored preferences are unusable', () => {
            localStorage.setItem(PREFS_KEY, 'not json');
            renderList([first]);

            expect(storedPrefs()).toEqual({
                pageSize: 200,
                wrapText: true,
                enabledLevels: ['error', 'warn', 'info', 'debug'],
                sortAsc: false,
                node: '',
            });
        });

        test('should ignore stored values outside the supported set', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({
                pageSize: 7,
                wrapText: 'yes',
                enabledLevels: ['nope'],
                sortAsc: 'maybe',
                node: 42,
            }));

            renderList([first]);

            expect(storedPrefs()).toEqual({
                pageSize: 200,
                wrapText: true,
                enabledLevels: ['error', 'warn', 'info', 'debug'],
                sortAsc: false,
                node: '',
            });
        });
    });

    describe('stored node', () => {
        test('should restore the stored node', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({node: 'node-b'}));

            expect(loadPrefs().node).toBe('node-b');
        });

        test('should load prefs saved before the node existed as all nodes', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({pageSize: 50, wrapText: false, enabledLevels: ['error'], sortAsc: true}));

            expect(loadPrefs()).toEqual({pageSize: 50, wrapText: false, enabledLevels: ['error'], sortAsc: true, node: ''});
        });

        test('should save the selected node', () => {
            renderListWith({logs: [makeNodeLog('node-b', 'b')], nodes: ['node-a', 'node-b'], selectedNode: 'node-b'});

            expect(storedPrefs().node).toBe('node-b');
        });
    });

    describe('nodes', () => {
        beforeEach(pinAscendingSort);

        test('should hide the node selector and node column with a single node', () => {
            renderListWith({logs: [makeNodeLog('default', 'a')], nodes: ['default']});

            expect(screen.queryByLabelText('Node')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Open menu to select a node')).not.toBeInTheDocument();
            expect(rowNodes()).toEqual([]);
            expect(document.querySelector('.LogViewer__header-node')).toBeNull();
            expect(document.querySelector('.LogRow--with-node')).toBeNull();
            expect(rowMessages()).toEqual(['a']);
        });

        test('should hide the node selector before any node is known', () => {
            renderListWith({logs: [makeLog('untagged', '2026-03-12T10:00:01.000Z')]});

            expect(screen.queryByLabelText('Open menu to select a node')).not.toBeInTheDocument();
            expect(rowMessages()).toEqual(['untagged']);
        });

        test('should show the node selector and node column with two or more nodes', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'a', '2026-03-12T10:00:01.000Z'), makeNodeLog('node-b', 'b', '2026-03-12T10:00:02.000Z')],
                nodes: ['node-a', 'node-b'],
            });

            expect(screen.getByLabelText('Node')).toHaveValue('All nodes');
            expect(rowNodes()).toEqual(['node-a', 'node-b']);
            expect(document.querySelector('.LogViewer__header-node')).toHaveTextContent('Node');

            openNodeMenu();
            expect(within(screen.getByRole('menu', {name: 'Node menu'})).getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual(['All nodes', 'node-a', 'node-b']);
            expect(screen.getByRole('menuitemradio', {name: 'All nodes'})).toHaveAttribute('aria-checked', 'true');
            expect(screen.getByRole('menuitemradio', {name: 'node-a'})).toHaveAttribute('aria-checked', 'false');
        });

        test('should keep the node selector while a node is selected, even if it is the only node known', () => {
            renderListWith({logs: [makeNodeLog('node-b', 'b')], nodes: ['node-b'], selectedNode: 'node-b'});

            expect(screen.getByLabelText('Node')).toHaveValue('node-b');
            expect(rowNodes()).toEqual([]);
            expect(document.querySelector('.LogViewer__header-node')).toBeNull();

            openNodeMenu();
            expect(screen.getByRole('menuitemradio', {name: 'node-b'})).toHaveAttribute('aria-checked', 'true');
        });

        test('should report the picked node, and an empty node for all nodes', async () => {
            const onSelectedNodeChange = jest.fn();
            const logs = [makeNodeLog('node-a', 'a'), makeNodeLog('node-b', 'b')];
            const {unmount} = renderListWith({logs, nodes: ['node-a', 'node-b'], onSelectedNodeChange});

            openNodeMenu();
            fireEvent.click(screen.getByRole('menuitemradio', {name: 'node-b'}));
            await waitFor(() => expect(onSelectedNodeChange).toHaveBeenCalledWith('node-b'));
            unmount();

            onSelectedNodeChange.mockClear();
            renderListWith({logs, nodes: ['node-a', 'node-b'], selectedNode: 'node-b', onSelectedNodeChange});

            openNodeMenu();
            fireEvent.click(screen.getByRole('menuitemradio', {name: 'All nodes'}));
            await waitFor(() => expect(onSelectedNodeChange).toHaveBeenCalledWith(''));
        });

        test('should only show the selected node\'s entries', () => {
            renderListWith({
                logs: [
                    makeNodeLog('node-a', 'a 1', '2026-03-12T10:00:01.000Z'),
                    makeNodeLog('node-b', 'b 1', '2026-03-12T10:00:02.000Z'),
                    makeNodeLog('node-a', 'a 2', '2026-03-12T10:00:03.000Z'),
                ],
                nodes: ['node-a', 'node-b'],
                selectedNode: 'node-a',
            });

            expect(rowMessages()).toEqual(['a 1', 'a 2']);
            expect(document.querySelector('.LogViewer__footer-info')).toHaveTextContent('Showing 1 - 2 of 2');
        });

        test('should count only the selected node\'s entries per level', () => {
            renderListWith({
                logs: [
                    makeNodeLog('node-a', 'a', '2026-03-12T10:00:01.000Z', LogLevelEnum.ERROR),
                    makeNodeLog('node-b', 'b', '2026-03-12T10:00:02.000Z', LogLevelEnum.ERROR),
                ],
                nodes: ['node-a', 'node-b'],
                selectedNode: 'node-b',
            });

            openLevelsMenu();
            expect(levelMenuItem('Error')).toHaveTextContent('Error1');
        });

        test('should search the node name with two or more nodes', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'a', '2026-03-12T10:00:01.000Z'), makeNodeLog('node-b', 'b', '2026-03-12T10:00:02.000Z')],
                nodes: ['node-a', 'node-b'],
                search: 'node-b',
            });

            expect(rowMessages()).toEqual(['b']);
            expect(document.querySelector('.LogRow__node mark')).toHaveTextContent('node-b');
        });

        test('should search a node field the server logged', () => {
            renderListWith({
                logs: [
                    {...makeNodeLog('node-a', 'A node has joined the cluster'), node: 'node-b'},
                    makeNodeLog('node-a', 'other'),
                ],
                nodes: ['node-a', 'node-b'],
                selectedNode: 'node-a',
                search: 'node-b',
            });

            expect(rowMessages()).toEqual(['A node has joined the cluster']);
        });

        test('should not search the node name with a single node', () => {
            renderListWith({logs: [makeNodeLog('default', 'a')], nodes: ['default'], search: 'default'});

            expect(rowMessages()).toEqual([]);
            expect(screen.getByText(/No logs match your filters/)).toBeInTheDocument();
        });

        test('should offer to clear the selected node when it has no entries', () => {
            const onSelectedNodeChange = jest.fn();
            renderListWith({logs: [], nodes: ['node-a', 'node-b'], selectedNode: 'node-b', onSelectedNodeChange});

            expect(screen.getByText(/No logs match your filters/)).toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
            expect(onSelectedNodeChange).toHaveBeenCalledWith('');
        });

        test('should keep identical lines from different nodes as separate rows', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'same'), makeNodeLog('node-b', 'same')],
                nodes: ['node-a', 'node-b'],
            });

            expect(rowNodes()).toEqual(['node-a', 'node-b']);
        });

        test('should render a failed node as an error row', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'fine'), makeFailedNodeLog('node-b')],
                nodes: ['node-a', 'node-b'],
            });

            const row = screen.getByText('Failed to fetch logs from node').closest('.LogRow');
            expect(row).toHaveClass('LogRow--error-bg');
            expect(row?.querySelector('.LogRow__node')).toHaveTextContent('node-b');

            fireEvent.click(row!.querySelector('.LogRow__main')!);
            expect(screen.getByText('connection refused')).toBeInTheDocument();
        });

        test('should count a failed node as an error', () => {
            renderListWith({
                logs: [makeNodeLog('node-a', 'fine'), makeFailedNodeLog('node-b')],
                nodes: ['node-a', 'node-b'],
            });

            openLevelsMenu();
            expect(levelMenuItem('Error')).toHaveTextContent('Error1');
            expect(levelMenuItem('Info')).toHaveTextContent('Info1');
        });
    });

    describe('time range', () => {
        beforeEach(() => {
            pinAscendingSort();
            jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-12T10:10:00.000Z'));
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        // The failed-node entry is older than the cutoff on purpose
        const timeRangeLogs = [
            makeLog('old', '2026-03-12T10:04:59.000Z'),
            makeLog('recent', '2026-03-12T10:05:30.000Z'),
            makeLog('unparseable', 'not a timestamp'),
            makeFailedNodeLog('node-b', '2026-03-12 09:00:00.000 +00:00'),
        ];

        test('should drop entries older than the active time range', () => {
            renderListWith({logs: timeRangeLogs, activeTimePreset: 5});

            expect(rowMessages().sort()).toEqual(['Failed to fetch logs from node', 'recent', 'unparseable']);
            expect(document.querySelector('.LogViewer__footer-info')).toHaveTextContent('of 3');
        });

        test('should keep an entry exactly at the cutoff', () => {
            renderListWith({logs: [makeLog('edge', '2026-03-12T10:05:00.000Z')], activeTimePreset: 5});

            expect(rowMessages()).toEqual(['edge']);
        });

        test('should parse the server timestamp format against the cutoff', () => {
            renderListWith({
                logs: [
                    makeLog('old', '2026-03-12 12:04:59.000 +02:00'),
                    makeLog('recent', '2026-03-12 12:05:30.000 +02:00'),
                    makeLog('old utc', '2026-03-12 10:04:59.000 Z'),
                    makeLog('recent utc', '2026-03-12 10:05:45.000 Z'),
                ],
                activeTimePreset: 5,
            });

            expect(rowMessages()).toEqual(['recent', 'recent utc']);
        });

        test('should count only entries in the time range per level', () => {
            renderListWith({logs: timeRangeLogs, activeTimePreset: 5});

            openLevelsMenu();
            expect(levelMenuItem('Info')).toHaveTextContent('Info2');
            expect(levelMenuItem('Error')).toHaveTextContent('Error1');
        });

        test('should count only entries in the time range as search matches', () => {
            renderListWith({logs: timeRangeLogs, activeTimePreset: 5, search: 'recent'});

            expect(screen.getByText(/of 1 entries matching your filters$/)).toBeInTheDocument();
        });

        test('should show every entry without a time range', () => {
            renderListWith({logs: timeRangeLogs, activeTimePreset: null});

            expect(rowMessages()).toHaveLength(4);
        });

        test('should still hide a failed node when errors are turned off', () => {
            pinAscendingSort({enabledLevels: ['info']});
            renderListWith({logs: timeRangeLogs, activeTimePreset: 5});

            expect(rowMessages()).not.toContain('Failed to fetch logs from node');
            expect(rowMessages().sort()).toEqual(['recent', 'unparseable']);
        });

        test('should only keep an entry older than the time range when the server marked it as a failed node', () => {
            // Same message as the failed-node entry, but logged by the node itself
            const logged = makeLog('Failed to fetch logs from node', '2026-03-12T09:00:00.000Z', LogLevelEnum.ERROR);
            renderListWith({logs: [logged, makeLog('recent', '2026-03-12T10:05:30.000Z')], activeTimePreset: 5});

            expect(rowMessages()).toEqual(['recent']);
        });

        test('should offer to clear a time range that filters out every entry', () => {
            const onClearTimePreset = jest.fn();
            renderListWith({logs: [makeLog('old', '2026-03-12T10:04:59.000Z')], activeTimePreset: 5, onClearTimePreset});

            expect(screen.getByText(/No logs match your filters/)).toBeInTheDocument();
            expect(screen.queryByText(/No logs found/)).not.toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
            expect(onClearTimePreset).toHaveBeenCalledTimes(1);
        });

        test('should go back to the first page when the time range changes', () => {
            pinAscendingSort({pageSize: 50});
            const {rerender} = renderListWith({logs: makeLogs(60)});

            fireEvent.click(screen.getByLabelText('Next page'));
            expect(document.querySelector('.LogViewer__page-indicator')).toHaveTextContent('Page 2 of 2');

            // Every entry is inside the range, so only the reset can move the page
            rerender(
                <StatefulLogList
                    {...baseProps}
                    logs={makeLogs(60)}
                    activeTimePreset={15}
                />,
            );

            expect(document.querySelector('.LogViewer__page-indicator')).toHaveTextContent('Page 1 of 2');
        });

        test('should apply the time range and the selected node together', () => {
            renderListWith({
                logs: [
                    makeNodeLog('node-a', 'a old', '2026-03-12T10:00:00.000Z'),
                    makeNodeLog('node-a', 'a recent', '2026-03-12T10:09:00.000Z'),
                    makeNodeLog('node-b', 'b recent', '2026-03-12T10:09:00.000Z'),
                ],
                nodes: ['node-a', 'node-b'],
                selectedNode: 'node-a',
                activeTimePreset: 5,
            });

            expect(rowMessages()).toEqual(['a recent']);
        });
    });

    describe('keyboard shortcuts', () => {
        beforeEach(pinAscendingSort);

        test('should focus the search input on /', () => {
            renderList([first, second, third]);

            pressKey('/');

            expect(document.activeElement).toBe(screen.getByLabelText('Search logs'));
        });

        test('should leave typing in the search input alone', () => {
            renderList([first, second, third]);

            fireEvent.keyDown(screen.getByLabelText('Search logs'), {key: 'ArrowDown'});

            expect(focusedRow()).toBeNull();
        });
    });
});
