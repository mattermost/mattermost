// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {proposeAddParent, proposeReplaceOccurrenceParent} from './graph_parent_ops';

const opt = (name: string, parents: string[] = []): PropertyFieldOption => ({id: '', name, parents});

const freezeGraph = (options: PropertyFieldOption[]): PropertyFieldOption[] => {
    return Object.freeze(options.map((option) => Object.freeze({
        ...option,
        parents: option.parents ? Object.freeze([...option.parents]) : option.parents,
    })));
};

describe('proposeAddParent', () => {
    test('leaf add applies immediately without confirmGrant', async () => {
        const options = [opt('P'), opt('C')];
        const confirmGrant = jest.fn();
        const result = await proposeAddParent(options, 'C', 'P', confirmGrant);

        expect(confirmGrant).not.toHaveBeenCalled();
        expect(result.status).toBe('applied');
        if (result.status === 'applied') {
            expect(result.options.find((o) => o.name === 'C')?.parents).toEqual(['P']);
        }
    });

    test('already_d child-only newly reachable applies without confirmGrant', async () => {
        const alreadyD = [
            opt('P'),
            opt('X', ['P']),
            opt('R'),
            opt('C', ['R']),
            opt('D', ['X', 'C']),
        ];
        const confirmGrant = jest.fn();
        const result = await proposeAddParent(alreadyD, 'C', 'P', confirmGrant);

        expect(confirmGrant).not.toHaveBeenCalled();
        expect(result.status).toBe('applied');
        if (result.status === 'applied') {
            expect(result.options.find((o) => o.name === 'C')?.parents).toEqual(['R', 'P']);
        }
    });

    test('grant-needed add confirms then applies', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const confirmGrant = jest.fn().mockResolvedValue(true);
        const result = await proposeAddParent(options, 'C', 'P', confirmGrant);

        expect(confirmGrant).toHaveBeenCalledTimes(1);
        expect(confirmGrant).toHaveBeenCalledWith({
            parentName: 'P',
            childName: 'C',
            newlyReachable: ['D'],
            ancestorsOfParent: [],
        });
        expect(result.status).toBe('applied');
        if (result.status === 'applied') {
            expect(result.options.find((o) => o.name === 'C')?.parents).toEqual(['P']);
            expect(result.options.find((o) => o.name === 'D')?.parents).toEqual(['C']);
        }
    });

    test('grant-needed add cancel does not mutate', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const confirmGrant = jest.fn().mockResolvedValue(false);
        const result = await proposeAddParent(options, 'C', 'P', confirmGrant);

        expect(result.status).toBe('cancelled');
        expect(result).not.toEqual(expect.objectContaining({status: 'applied'}));
        expect(options.find((o) => o.name === 'C')?.parents).toEqual([]);
    });

    test('grant-needed without confirmGrant is fail-closed', async () => {
        const options = [opt('P'), opt('C'), opt('D', ['C'])];
        const result = await proposeAddParent(options, 'C', 'P');

        expect(result.status).toBe('fail-closed');
        expect(options.find((o) => o.name === 'C')?.parents).toEqual([]);
    });

    test('duplicate parent is noOp without confirmGrant', async () => {
        const options = [opt('R'), opt('S'), opt('C', ['R', 'S'])];
        const confirmGrant = jest.fn();
        const result = await proposeAddParent(options, 'C', 'S', confirmGrant);

        expect(result.status).toBe('noOp');
        expect(confirmGrant).not.toHaveBeenCalled();
    });

    test('cycle is invalid without confirmGrant', async () => {
        const chain = [opt('A'), opt('B', ['A']), opt('C', ['B'])];
        const confirmGrant = jest.fn();
        const result = await proposeAddParent(chain, 'A', 'C', confirmGrant);

        expect(result.status).toBe('invalid');
        if (result.status === 'invalid') {
            expect(result.check.error).toBe('cycle');
        }
        expect(confirmGrant).not.toHaveBeenCalled();
    });

    test('does not mutate input on applied add', async () => {
        const options = freezeGraph([opt('P'), opt('C')]);
        const result = await proposeAddParent(options, 'C', 'P');

        expect(result.status).toBe('applied');
        expect(options.find((o) => o.name === 'C')?.parents).toEqual([]);
    });
});

describe('proposeReplaceOccurrenceParent', () => {
    test('reparent onto ancestor is vs_original: no confirmGrant, R replaced by P', async () => {
        const shortcut = [
            opt('P'),
            opt('R', ['P']),
            opt('C', ['R']),
            opt('D', ['C']),
        ];
        const confirmGrant = jest.fn();
        const result = await proposeReplaceOccurrenceParent(shortcut, 'C', 'R', 'P', confirmGrant);

        expect(confirmGrant).not.toHaveBeenCalled();
        expect(result.status).toBe('applied');
        if (result.status === 'applied') {
            expect(result.options.find((o) => o.name === 'C')?.parents).toEqual(['P']);
        }
    });

    test('replace that newly reaches descendants confirms D not C', async () => {
        const options = [opt('R'), opt('C', ['R']), opt('D', ['C']), opt('P')];
        const confirmGrant = jest.fn().mockResolvedValue(true);
        const result = await proposeReplaceOccurrenceParent(options, 'C', 'R', 'P', confirmGrant);

        expect(confirmGrant).toHaveBeenCalledTimes(1);
        expect(confirmGrant.mock.calls[0][0].newlyReachable).toEqual(['D']);
        expect(confirmGrant.mock.calls[0][0].newlyReachable).not.toContain('C');
        expect(confirmGrant).toHaveBeenCalledWith(expect.objectContaining({
            parentName: 'P',
            childName: 'C',
            newlyReachable: ['D'],
        }));
        expect(result.status).toBe('applied');
        if (result.status === 'applied') {
            expect(result.options.find((o) => o.name === 'C')?.parents).toEqual(['P']);
        }
    });

    test('grant-needed replace cancel does not mutate', async () => {
        const options = [opt('R'), opt('C', ['R']), opt('D', ['C']), opt('P')];
        const confirmGrant = jest.fn().mockResolvedValue(false);
        const result = await proposeReplaceOccurrenceParent(options, 'C', 'R', 'P', confirmGrant);

        expect(result.status).toBe('cancelled');
        expect(options.find((o) => o.name === 'C')?.parents).toEqual(['R']);
    });
});
