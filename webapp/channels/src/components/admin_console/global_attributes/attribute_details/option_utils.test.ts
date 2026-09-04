// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import {moveOptionByIndex} from './option_utils';

const opt = (name: string): PropertyFieldOption => ({id: '', name});

describe('option_utils', () => {
    describe('moveOptionByIndex', () => {
        const options = [opt('Alpha'), opt('Bravo'), opt('Charlie')];

        test('moves an option forward to the given position', () => {
            expect(moveOptionByIndex(options, 0, 2).map((o) => o.name)).toEqual(['Bravo', 'Charlie', 'Alpha']);
        });

        test('moves an option backward to the given position', () => {
            expect(moveOptionByIndex(options, 2, 0).map((o) => o.name)).toEqual(['Charlie', 'Alpha', 'Bravo']);
        });

        test('is a no-op when the source and target positions match', () => {
            expect(moveOptionByIndex(options, 1, 1).map((o) => o.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
        });

        test('leaves no rank field behind -- order is array position only', () => {
            expect(moveOptionByIndex(options, 0, 1).every((o) => o.rank === undefined)).toBe(true);
        });

        test('does not mutate the input array', () => {
            moveOptionByIndex(options, 0, 2);
            expect(options.map((o) => o.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
        });
    });
});
