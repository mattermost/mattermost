// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {renderWithContext, fireEvent, screen} from 'tests/react_testing_utils';

import LogList from './log_list';
import type {LogObjectWithAdditionalInfo} from './types';

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

function pressArrow(direction: 'ArrowDown' | 'ArrowUp', times = 1) {
    for (let i = 0; i < times; i++) {
        fireEvent.keyDown(screen.getByRole('list'), {key: direction});
    }
}

function focusedRow(): Element | null {
    return document.querySelector('.LogRow--focused');
}

function focusedRowMessage(): string | undefined {
    return focusedRow()?.querySelector('.LogRow__message')?.textContent ?? undefined;
}

describe('components/admin_console/server_logs/LogList', () => {
    beforeEach(() => {
        localStorage.clear();

        // Not implemented by jsdom
        Element.prototype.scrollIntoView = jest.fn();
    });

    const first = makeLog('msg 1', '2026-03-12T10:00:01.000Z');
    const second = makeLog('msg 2', '2026-03-12T10:00:02.000Z');
    const third = makeLog('msg 3', '2026-03-12T10:00:03.000Z');

    test('should move the selection with the arrow keys', () => {
        renderWithContext(
            <LogList
                {...baseProps}
                logs={[first, second, third]}
            />,
        );

        pressArrow('ArrowDown', 2);
        expect(focusedRowMessage()).toBe('msg 2');
        expect(document.activeElement).toBe(focusedRow()?.querySelector('.LogRow__main'));

        pressArrow('ArrowUp');
        expect(focusedRowMessage()).toBe('msg 1');
    });

    test('should keep the selection on the same entry when new logs arrive', () => {
        const {rerender} = renderWithContext(
            <LogList
                {...baseProps}
                logs={[first, second, third]}
            />,
        );

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
        const {rerender} = renderWithContext(
            <LogList
                {...baseProps}
                logs={[first, second, third]}
            />,
        );

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
        localStorage.setItem('mm_admin_logs_prefs', JSON.stringify({sortAsc: false}));

        const {rerender} = renderWithContext(
            <LogList
                {...baseProps}
                logs={[first, second, third]}
            />,
        );

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
        const {rerender} = renderWithContext(
            <LogList
                {...baseProps}
                logs={[first, second, third]}
            />,
        );

        pressArrow('ArrowDown');
        expect(focusedRowMessage()).toBe('msg 1');

        rerender(
            <LogList
                {...baseProps}
                logs={[second, third]}
            />,
        );

        expect(document.querySelector('.LogRow--focused')).toBeNull();
    });
});
