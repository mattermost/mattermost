// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import type {SuggestionResults} from 'components/suggestion/suggestion_results';

import {TestHelper} from 'utils/test_helper';

import {countResults, flattenItems, flattenTerms, getItemForTerm, hasLoadedResults, isItemLoaded, trimResults} from './suggestion_results';

describe('isItemLoaded', () => {
    test('should return whether or not an item is loaded', () => {
        expect(isItemLoaded(TestHelper.getUserMock())).toEqual(true);
        expect(isItemLoaded({loading: true})).toEqual(false);
    });
});

describe('hasLoadedResults', () => {
    const testCases: Array<{
        name: string;
        input: SuggestionResults;
        expected: boolean;
    }> = [
        {
            name: 'should return false for empty ungrouped results',
            input: {
                matchedPretext: '',
                terms: [],
                items: [],
                components: [],
            },
            expected: false,
        },
        {
            name: 'should return false for empty grouped results',
            input: {
                matchedPretext: '',
                groups: [],
            },
            expected: false,
        },
        {
            name: 'should return false for ungrouped results with only a loading item',
            input: {
                matchedPretext: '',
                terms: [''],
                items: [{loading: true}],
                components: ['span'],
            },
            expected: false,
        },
        {
            name: 'should return false for grouped results with only a loading item',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'test-users',
                        label: {},
                        terms: [''],
                        items: [{loading: true}],
                        components: ['span'],
                    },
                ],
            },
            expected: false,
        },
        {
            name: 'should return true for ungrouped results with a single loaded user',
            input: {
                matchedPretext: '',
                terms: ['test-user'],
                items: [TestHelper.getUserMock({username: 'test-user'})],
                components: ['span'],
            },
            expected: true,
        },
        {
            name: 'should return true for grouped results with a single loaded user',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'test-users',
                        label: {},
                        terms: ['test-user'],
                        items: [TestHelper.getUserMock({username: 'test-user'})],
                        components: ['span'],
                    },
                ],
            },
            expected: true,
        },
    ];

    for (const testCase of testCases) {
        test(testCase.name, () => {
            expect(hasLoadedResults(testCase.input)).toEqual(testCase.expected);
        });
    }
});

describe('countResults', () => {
    const testCases: Array<{
        name: string;
        input: SuggestionResults;
        expected: number;
    }> = [
        {
            name: 'should return 0 for empty ungrouped results',
            input: {
                matchedPretext: '',
                terms: [],
                items: [],
                components: [],
            },
            expected: 0,
        },
        {
            name: 'should return 0 for empty grouped results',
            input: {
                matchedPretext: '',
                groups: [],
            },
            expected: 0,
        },
        {
            name: 'should be able to count ungrouped results',
            input: {
                matchedPretext: '',
                terms: ['a', 'b', 'c'],
                items: ['a', 'b', 'c'],
                components: ['span', 'span', 'span'],
            },
            expected: 3,
        },
        {
            name: 'should be able to count grouped results',
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
                        key: 'de',
                        label: {},
                        terms: ['d', 'e'],
                        items: ['d', 'e'],
                        components: ['span', 'span'],
                    },
                ],
            },
            expected: 5,
        },
    ];

    for (const testCase of testCases) {
        test(testCase.name, () => {
            expect(countResults(testCase.input)).toEqual(testCase.expected);
        });
    }
});

describe('getItemForTerm', () => {
    const testCases: Array<{
        name: string;
        inputResults: SuggestionResults;
        inputTerm: string;
        expected: string | undefined;
    }> = [
        {
            name: 'should return the item matching a term with ungrouped results',
            inputResults: {
                matchedPretext: '',
                terms: ['a', 'b', 'c'],
                items: ['item-a', 'item-b', 'item-c'],
                components: ['span', 'span', 'span'],
            },
            inputTerm: 'a',
            expected: 'item-a',
        },
        {
            name: 'should return the item matching a term with grouped results',
            inputResults: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['item-a', 'item-b', 'item-c'],
                        components: ['span', 'span', 'span'],
                    },
                ],
            },
            inputTerm: 'c',
            expected: 'item-c',
        },
        {
            name: 'should return undefined when a term isn\'t found with ungrouped results',
            inputResults: {
                matchedPretext: '',
                terms: ['a', 'b', 'c'],
                items: ['item-a', 'item-b', 'item-c'],
                components: ['span', 'span', 'span'],
            },
            inputTerm: 'd',
            expected: undefined,
        },
        {
            name: 'should return undefined when a term isn\'t found with grouped results',
            inputResults: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'abc',
                        label: {},
                        terms: ['a', 'b', 'c'],
                        items: ['item-a', 'item-b', 'item-c'],
                        components: ['span', 'span', 'span'],
                    },
                ],
            },
            inputTerm: 'd',
            expected: undefined,
        },
    ];

    for (const testCase of testCases) {
        test(testCase.name, () => {
            expect(getItemForTerm(testCase.inputResults, testCase.inputTerm)).toEqual(testCase.expected);
        });
    }
});

describe('flattenTerms and flattenItems', () => {
    const testCases: Array<{
        name: string;
        input: SuggestionResults;
        expectedTerms: string[];
        expectedItems: string[];
    }> = [
        {
            name: 'should return flattened arrays for ungrouped results',
            input: {
                matchedPretext: '',
                terms: ['a', 'b', 'c'],
                items: ['item-a', 'item-b', 'item-c'],
                components: ['span', 'span', 'span'],
            },
            expectedTerms: ['a', 'b', 'c'],
            expectedItems: ['item-a', 'item-b', 'item-c'],
        },
        {
            name: 'should return flattened arrays for ungrouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {
                        key: 'ab',
                        label: {},
                        terms: ['a', 'b'],
                        items: ['item-a', 'item-b'],
                        components: ['span', 'span'],
                    },
                    {
                        key: 'c',
                        label: {},
                        terms: ['c'],
                        items: ['item-c'],
                        components: ['span'],
                    },
                    {
                        key: 'd',
                        label: {},
                        terms: [],
                        items: [],
                        components: [],
                    },
                ],
            },
            expectedTerms: ['a', 'b', 'c'],
            expectedItems: ['item-a', 'item-b', 'item-c'],
        },
    ];

    for (const testCase of testCases) {
        test(testCase.name, () => {
            expect(flattenTerms(testCase.input)).toEqual(testCase.expectedTerms);
            expect(flattenItems(testCase.input)).toEqual(testCase.expectedItems);
        });
    }
});

describe('trimResults', () => {
    const max = 4;

    const testCases: Array<{
        name: string;
        input: SuggestionResults;
        expected: SuggestionResults | undefined;
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
