// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';
import type {LogObject} from '@mattermost/types/admin';
import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import {getAllLogsWithNode, getLogNodes, getScanLimitedLogNodes, getTruncatedLogNodes} from 'mattermost-redux/selectors/entities/admin';

function makeLog(msg: string): LogObject {
    return {
        caller: `caller ${msg}`,
        job_id: '',
        level: LogLevelEnum.INFO,
        msg,
        timestamp: '2026-10-21 11:02:03.456 +02:00',
        worker: '',
    };
}

function stateWith(logs: unknown) {
    return {entities: {admin: {logs}}} as unknown as GlobalState;
}

describe('selectors.entities.admin', () => {
    const e1 = makeLog('one');
    const e2 = makeLog('two');
    const e3 = makeLog('three');

    test('getAllLogsWithNode tags every entry with the node it came from', () => {
        const state = stateWith({'node-a': [e1, e2], 'node-b': [e3]});

        expect(getAllLogsWithNode(state)).toEqual([
            {...e1, [LogNodeKey]: 'node-a'},
            {...e2, [LogNodeKey]: 'node-a'},
            {...e3, [LogNodeKey]: 'node-b'},
        ]);
    });

    test('getAllLogsWithNode returns no entries before the first fetch', () => {
        expect(getAllLogsWithNode(stateWith({}))).toEqual([]);
    });

    test('getAllLogsWithNode returns no entries for a node with none', () => {
        expect(getAllLogsWithNode(stateWith({'node-a': []}))).toEqual([]);
    });

    test('getAllLogsWithNode returns the same array for the same state', () => {
        const state = stateWith({'node-a': [e1]});

        expect(getAllLogsWithNode(state)).toBe(getAllLogsWithNode(state));
    });

    test('getAllLogsWithNode keeps a node field the server logged', () => {
        const state = stateWith({'node-a': [{...e1, node: 'node-b'}]});

        expect(getAllLogsWithNode(state)).toEqual([{...e1, node: 'node-b', [LogNodeKey]: 'node-a'}]);
    });

    test('getAllLogsWithNode leaves the stored entries untouched', () => {
        const state = stateWith({'node-a': [e1]});

        getAllLogsWithNode(state);

        expect(e1).not.toHaveProperty('node');
        expect(state.entities.admin.logs).toEqual({'node-a': [e1]});
    });

    test('getLogNodes lists every node, including one with no entries', () => {
        expect(getLogNodes(stateWith({'node-a': [e1], 'node-b': []}))).toEqual(['node-a', 'node-b']);
    });

    test('getLogNodes returns no nodes before the first fetch', () => {
        expect(getLogNodes(stateWith([]))).toEqual([]);
    });

    test('getTruncatedLogNodes lists only the nodes that returned a full page', () => {
        const fullPage = Array.from({length: General.LOGS_PAGE_SIZE_DEFAULT}, () => e1);

        expect(getTruncatedLogNodes(stateWith({'node-a': fullPage, 'node-b': fullPage.slice(1), 'node-c': []}))).toEqual(['node-a']);
    });

    test('getTruncatedLogNodes returns no nodes before the first fetch', () => {
        expect(getTruncatedLogNodes(stateWith([]))).toEqual([]);
    });

    const scanLimit = (scannedBackTo?: string): LogObject => ({
        ...makeLog('Log scan stopped at its limit'),
        level: LogLevelEnum.WARN,
        scan_limited: true,
        scanned_back_to: scannedBackTo,
    });

    test('getAllLogsWithNode leaves out scan limit entries', () => {
        const state = stateWith({'node-a': [e1, scanLimit('2026-10-21 09:00:00.000 Z')]});

        expect(getAllLogsWithNode(state)).toEqual([{...e1, [LogNodeKey]: 'node-a'}]);
    });

    test('getTruncatedLogNodes does not count a scan limit entry', () => {
        const almostFull = Array.from({length: General.LOGS_PAGE_SIZE_DEFAULT - 1}, () => e1);

        expect(getTruncatedLogNodes(stateWith({'node-a': [...almostFull, scanLimit()]}))).toEqual([]);
    });

    test('getScanLimitedLogNodes lists the nodes whose scan stopped at its limit', () => {
        const state = stateWith({
            'node-c': [e1, scanLimit()],
            'node-a': [e2, scanLimit('2026-10-21 09:00:00.000 Z')],
            'node-b': [e3],
        });

        expect(getScanLimitedLogNodes(state)).toEqual([
            {node: 'node-a', scannedBackTo: '2026-10-21 09:00:00.000 Z'},
            {node: 'node-c', scannedBackTo: undefined},
        ]);
        expect(getScanLimitedLogNodes(stateWith({}))).toEqual([]);
    });
});
