// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevelEnum, LogNodeKey} from '@mattermost/types/admin';
import type {LogObject} from '@mattermost/types/admin';
import type {GlobalState} from '@mattermost/types/store';

import {getAllLogs, getAllLogsWithNode, getLogNodes} from 'mattermost-redux/selectors/entities/admin';

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
        expect(getAllLogsWithNode(stateWith([]))).toEqual([]);
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
        expect(getAllLogs(state)).toEqual([e1]);
    });

    test('getLogNodes lists every node, including one with no entries', () => {
        expect(getLogNodes(stateWith({'node-a': [e1], 'node-b': []}))).toEqual(['node-a', 'node-b']);
    });

    test('getLogNodes returns no nodes before the first fetch', () => {
        expect(getLogNodes(stateWith([]))).toEqual([]);
    });
});
