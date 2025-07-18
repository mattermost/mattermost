// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import type {SuggestionResults} from 'components/suggestion/suggestion_results';

import {trimResults} from './suggestion_results';

describe('trimResults', () => {
    const max = 4;

    const testCases: Array<{
        name: string;
        input: SuggestionResults<string>;
        expected: SuggestionResults<string> | undefined;
    }> = [
        {
            name: 'should do nothing with empty ungrouped results',
            input: {
                matchedPretext: '',
                terms: [],
                items: [],
                components: [],
            },
            expected: undefined,
        },
        {
            name: 'should do nothing with empty grouped results',
            input: {
                matchedPretext: '',
                groups: [],
            },
            expected: undefined,
        },
        {
            name: 'should do nothing with fewer than max ungrouped results',
            input: {
                matchedPretext: '',
                terms: ['a', 'b'],
                items: ['a', 'b'],
                components: ['span', 'span'],
            },
            expected: undefined,
        },
        {
            name: 'should do nothing with fewer than max grouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'ab',
                        label: {},
                        terms: ['a', 'b'],
                        items: ['a', 'b'],
                        components: ['span', 'span'],
                    },
                    {
                        key: 'c',
                        label: {},
                        terms: ['c'],
                        items: ['c'],
                        components: ['span'],
                    },
                ],
            },
            expected: undefined,
        },
        {
            name: 'should trim more than max ungrouped results by removing extra terms/items/components',
            input: {
                matchedPretext: '',
                terms: ['a', 'b', 'c', 'd', 'e', 'f'],
                items: ['a', 'b', 'c', 'd', 'e', 'f'],
                components: ['span', 'span', 'span', 'span', 'span', 'span'],
            },
            expected: {
                matchedPretext: '',
                terms: ['a', 'b', 'c', 'd'],
                items: ['a', 'b', 'c', 'd'],
                components: ['span', 'span', 'span', 'span'],
            },
        },
        {
            name: 'should trim more than max grouped results by removing extra terms/items/components',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['a', 'b', 'c'],
                        components: ['span', 'span', 'span'],
                    },
                    {
                        key: 'def',
                        label: {},
                        terms: ['d', 'e', 'f'],
                        items: ['d', 'e', 'f'],
                        components: ['span', 'span', 'span'],
                    },
                ],
            },
            expected: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['a', 'b', 'c'],
                        components: ['span', 'span', 'span'],
                    },
                    {
                        key: 'def',
                        label: {},
                        terms: ['d'],
                        items: ['d'],
                        components: ['span'],
                    },
                ],
            },
        },
        {
            name: 'should trim more than max grouped results by removing extra terms/items/components and extra groups',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['a', 'b', 'c'],
                        components: ['span', 'span', 'span'],
                    },
                    {
                        key: 'def',
                        label: {},
                        terms: ['d', 'e', 'f'],
                        items: ['d', 'e', 'f'],
                        components: ['span', 'span', 'span'],
                    },
                    {
                        key: 'gh',
                        label: {},
                        terms: ['g', 'h'],
                        items: ['g', 'h'],
                        components: ['span', 'span'],
                    },
                ],
            },
            expected: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['a', 'b', 'c'],
                        components: ['span', 'span', 'span'],
                    },
                    {
                        key: 'def',
                        label: {},
                        terms: ['d'],
                        items: ['d'],
                        components: ['span'],
                    },
                ],
            },
        },
    ];

    for (const testCase of testCases) {
        test(testCase.name, () => {
            const input = testCase.input;
            const expected = testCase.expected ?? cloneDeep(input);

            expect(trimResults(input, max)).toEqual(expected);
        });
    }
});
