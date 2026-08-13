// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';

import LogList from './log_list';
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
    onSearchChange: jest.fn(),
    search: '',
    onReload: jest.fn(),
    downloadUrl: '',
    liveTailEnabled: false,
    onToggleLiveTail: jest.fn(),
    pollInterval: 5000,
    onPollIntervalChange: jest.fn(),
    pollIntervals: [5000],
    pollIntervalLabels: {5000: '5s'},
    showPollDropdown: false,
    onTogglePollDropdown: jest.fn(),
    lastUpdatedText: null,
    timePresets: [],
    activeTimePreset: null,
    onTimePreset: jest.fn(),
    onClearTimePreset: jest.fn(),
};

function renderList(logs: LogObjectWithAdditionalInfo[]) {
    return renderWithContext(
        <LogList
            {...baseProps}
            logs={logs}
        />,
    );
}

function pressKey(key: string, init: KeyboardEventInit = {}) {
    fireEvent.keyDown(screen.getByRole('list'), {key, ...init});
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

function rowMessages(): string[] {
    return Array.from(document.querySelectorAll('.LogRow__message')).map((el) => el.textContent ?? '');
}

function levelPill(label: string): HTMLElement {
    return screen.getByRole('button', {name: new RegExp(`^${label}`)});
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
                <LogList
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
                <LogList
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
                <LogList
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
                <LogList
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

        test('should hide and restore a level when its pill is clicked', () => {
            renderList(mixedLevels);

            fireEvent.click(levelPill('Debug'));
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info']);

            fireEvent.click(levelPill('Debug'));
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
        });

        test('should keep the last enabled level on, so the list cannot filter itself empty', () => {
            renderList(mixedLevels);

            fireEvent.click(levelPill('Error'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['an error']);

            fireEvent.click(levelPill('Error'));
            expect(rowMessages()).toEqual(['an error']);
        });

        test('should solo a level on ctrl-click and restore every level on a second ctrl-click', () => {
            renderList(mixedLevels);

            fireEvent.click(levelPill('Warn'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['a warning']);

            fireEvent.click(levelPill('Warn'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
        });

        test('should re-enable every level from the All pill', () => {
            renderList(mixedLevels);

            fireEvent.click(levelPill('Info'), {ctrlKey: true});
            expect(rowMessages()).toEqual(['some info']);

            fireEvent.click(levelPill('All'));
            expect(rowMessages()).toEqual(['an error', 'a warning', 'some info', 'a debug line']);
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
            expect(footerInfo()).toBe('1-50 of 60');
            expect(pageIndicator()).toBe('Page 1 of 2');
            expect(screen.getByLabelText('Previous page')).toBeDisabled();

            fireEvent.click(screen.getByLabelText('Next page'));
            expect(rowMessages()).toEqual(['msg 51', 'msg 52', 'msg 53', 'msg 54', 'msg 55', 'msg 56', 'msg 57', 'msg 58', 'msg 59', 'msg 60']);
            expect(footerInfo()).toBe('51-60 of 60');
            expect(screen.getByLabelText('Next page')).toBeDisabled();

            fireEvent.click(screen.getByLabelText('Previous page'));
            expect(rowMessages()[0]).toBe('msg 1');
            expect(pageIndicator()).toBe('Page 1 of 2');
        });

        test('should show more rows when the page size grows', () => {
            renderList(makeLogs(60));

            expect(rowMessages()).toHaveLength(50);

            fireEvent.change(screen.getByLabelText('Rows:'), {target: {value: '100'}});
            expect(rowMessages()).toHaveLength(60);
            expect(pageIndicator()).toBe('Page 1 of 1');
        });

        test('should clamp the page when the logs no longer fill it', () => {
            const {rerender} = renderList(makeLogs(60));

            fireEvent.click(screen.getByLabelText('Next page'));
            expect(pageIndicator()).toBe('Page 2 of 2');

            // A poll returns fewer entries than the current page starts at
            rerender(
                <LogList
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
            expect(screen.getByLabelText('Rows:')).toHaveValue('50');
            expect(screen.getByText('No wrap')).toBeInTheDocument();
        });

        test('should save a preference change', () => {
            renderList([first]);

            fireEvent.click(screen.getByText('Wrap'));

            expect(storedPrefs()).toEqual({
                pageSize: 200,
                wrapText: false,
                enabledLevels: ['error', 'warn', 'info', 'debug'],
                sortAsc: false,
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
            });
        });

        test('should ignore stored values outside the supported set', () => {
            localStorage.setItem(PREFS_KEY, JSON.stringify({
                pageSize: 7,
                wrapText: 'yes',
                enabledLevels: ['nope'],
                sortAsc: 'maybe',
            }));

            renderList([first]);

            expect(storedPrefs()).toEqual({
                pageSize: 200,
                wrapText: true,
                enabledLevels: ['error', 'warn', 'info', 'debug'],
                sortAsc: false,
            });
        });
    });

    describe('keyboard shortcuts', () => {
        beforeEach(pinAscendingSort);

        const withErrors = [
            makeLog('info 1', '2026-03-12T10:00:01.000Z'),
            makeLog('error 1', '2026-03-12T10:00:02.000Z', LogLevelEnum.ERROR),
            makeLog('info 2', '2026-03-12T10:00:03.000Z'),
            makeLog('error 2', '2026-03-12T10:00:04.000Z', LogLevelEnum.ERROR),
        ];

        test('should jump between the error rows with e and shift-e', () => {
            renderList(withErrors);

            pressKey('e');
            expect(focusedRowMessage()).toBe('error 1');

            pressKey('e');
            expect(focusedRowMessage()).toBe('error 2');

            // Nothing further down to jump to, so the selection stays put
            pressKey('e');
            expect(focusedRowMessage()).toBe('error 2');

            pressKey('E', {shiftKey: true});
            expect(focusedRowMessage()).toBe('error 1');
        });

        test('should focus the search input on /', () => {
            renderList(withErrors);

            pressKey('/');

            expect(document.activeElement).toBe(screen.getByPlaceholderText('Search logs...'));
        });

        test('should leave typing in the search input alone', () => {
            renderList(withErrors);

            fireEvent.keyDown(screen.getByPlaceholderText('Search logs...'), {key: 'e'});

            expect(focusedRow()).toBeNull();
        });
    });
});
