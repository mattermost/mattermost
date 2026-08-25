// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import type {ProviderResults, Suggestion, SuggestionResults} from 'components/suggestion/suggestion_results';

import {TestHelper} from 'utils/test_helper';

import {countResults, flattenItems, flattenTerms, getItemForTerm, hasLoadedResults, isItemLoaded, normalizeResultsFromProvider, trimResults} from './suggestion_results';

function suggestions(...terms: string[]): Suggestion[] {
    return terms.map((term) => ({term, item: `item-${term}`, component: 'span'}));
}

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
                suggestions: [],
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
                suggestions: [{term: '', item: {loading: true}, component: 'span'}],
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
                        suggestions: [{term: '', item: {loading: true}, component: 'span'}],
                    },
                ],
            },
            expected: false,
        },
        {
            name: 'should return true for ungrouped results with a single loaded user',
            input: {
                matchedPretext: '',
                suggestions: [{term: 'test-user', item: TestHelper.getUserMock({username: 'test-user'}), component: 'span'}],
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
                        suggestions: [{term: 'test-user', item: TestHelper.getUserMock({username: 'test-user'}), component: 'span'}],
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
                suggestions: [],
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
                suggestions: suggestions('a', 'b', 'c'),
            },
            expected: 3,
        },
        {
            name: 'should be able to count grouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                    {key: 'de', label: {}, suggestions: suggestions('d', 'e')},
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
                suggestions: suggestions('a', 'b', 'c'),
            },
            inputTerm: 'a',
            expected: 'item-a',
        },
        {
            name: 'should return the item matching a term with grouped results',
            inputResults: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                ],
            },
            inputTerm: 'c',
            expected: 'item-c',
        },
        {
            name: 'should return undefined when a term isn\'t found with ungrouped results',
            inputResults: {
                matchedPretext: '',
                suggestions: suggestions('a', 'b', 'c'),
            },
            inputTerm: 'd',
            expected: undefined,
        },
        {
            name: 'should return undefined when a term isn\'t found with grouped results',
            inputResults: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
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
                suggestions: suggestions('a', 'b', 'c'),
            },
            expectedTerms: ['a', 'b', 'c'],
            expectedItems: ['item-a', 'item-b', 'item-c'],
        },
        {
            name: 'should return flattened arrays for grouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'ab', label: {}, suggestions: suggestions('a', 'b')},
                    {key: 'c', label: {}, suggestions: suggestions('c')},
                    {key: 'd', label: {}, suggestions: []},
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

describe('normalizeResultsFromProvider', () => {
    test('should pair each term with its item and component for ungrouped results', () => {
        const results = normalizeResultsFromProvider({
            matchedPretext: 'a',
            terms: ['a', 'b'],
            items: ['item-a', 'item-b'],
            component: 'span',
        });

        expect(results).toEqual({
            matchedPretext: 'a',
            suggestions: [
                {term: 'a', item: 'item-a', component: 'span'},
                {term: 'b', item: 'item-b', component: 'span'},
            ],
        });
    });

    test('should pair each term with its item and component for grouped results', () => {
        const results = normalizeResultsFromProvider({
            matchedPretext: 'a',
            groups: [
                {
                    key: 'ab',
                    terms: ['a', 'b'],
                    items: ['item-a', 'item-b'],
                    component: 'span',
                },
                {
                    key: 'c',
                    terms: ['c'],
                    items: ['item-c'],
                    components: ['div'],
                },
            ],
        });

        expect(results).toEqual({
            matchedPretext: 'a',
            groups: [
                {
                    key: 'ab',
                    label: undefined,
                    suggestions: [
                        {term: 'a', item: 'item-a', component: 'span'},
                        {term: 'b', item: 'item-b', component: 'span'},
                    ],
                },
                {
                    key: 'c',
                    label: undefined,
                    suggestions: [{term: 'c', item: 'item-c', component: 'div'}],
                },
            ],
        });
    });

    test('should not be affected by later changes to the results from the provider', () => {
        const providerResults: ProviderResults<string> = {
            matchedPretext: 'a',
            groups: [
                {
                    key: 'ab',
                    terms: ['a'],
                    items: ['item-a'],
                    component: 'span',
                },
            ],
        };

        const results = normalizeResultsFromProvider(providerResults);

        // A provider may keep adding to the arrays that it built its results from, which must not change results
        // that have already been rendered
        providerResults.groups[0].terms.push('b');
        providerResults.groups[0].items.push('item-b');

        expect(countResults(results)).toEqual(1);
        expect(flattenTerms(results)).toEqual(['a']);
    });

    test('should return results that can\'t be modified outside of production', () => {
        const results = normalizeResultsFromProvider({
            matchedPretext: 'a',
            groups: [
                {
                    key: 'ab',
                    terms: ['a'],
                    items: ['item-a'],
                    component: 'span',
                },
            ],
        });

        if (!('groups' in results)) {
            throw new Error('expected grouped results');
        }

        expect(() => results.groups[0].suggestions.push({term: 'b', item: 'item-b', component: 'span'})).toThrow();
        expect(() => results.groups.push({key: 'cd', suggestions: []})).toThrow();
    });

    test('should ignore items without a term, since a term is what identifies a suggestion', () => {
        const results = normalizeResultsFromProvider({
            matchedPretext: 'a',
            terms: ['a'],
            items: ['item-a', 'item-b'],
            component: 'span',
        });

        expect(flattenTerms(results)).toEqual(['a']);
        expect(flattenItems(results)).toEqual(['item-a']);
    });
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
                suggestions: [],
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
                suggestions: suggestions('a', 'b'),
            },
            expected: undefined,
        },
        {
            name: 'should do nothing with fewer than max grouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'ab', label: {}, suggestions: suggestions('a', 'b')},
                    {key: 'c', label: {}, suggestions: suggestions('c')},
                ],
            },
            expected: undefined,
        },
        {
            name: 'should trim more than max ungrouped results',
            input: {
                matchedPretext: '',
                suggestions: suggestions('a', 'b', 'c', 'd', 'e', 'f'),
            },
            expected: {
                matchedPretext: '',
                suggestions: suggestions('a', 'b', 'c', 'd'),
            },
        },
        {
            name: 'should trim more than max grouped results',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                    {key: 'def', label: {}, suggestions: suggestions('d', 'e', 'f')},
                ],
            },
            expected: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                    {key: 'def', label: {}, suggestions: suggestions('d')},
                ],
            },
        },
        {
            name: 'should trim more than max grouped results by removing extra suggestions and extra groups',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                    {key: 'def', label: {}, suggestions: suggestions('d', 'e', 'f')},
                    {key: 'gh', label: {}, suggestions: suggestions('g', 'h')},
                ],
            },
            expected: {
                matchedPretext: '',
                groups: [
                    {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                    {key: 'def', label: {}, suggestions: suggestions('d')},
                ],
            },
        },
        {
            name: 'should remove groups left without any suggestions',
            input: {
                matchedPretext: '',
                groups: [
                    {key: 'empty', label: {}, suggestions: []},
                    {key: 'ab', label: {}, suggestions: suggestions('a', 'b')},
                ],
            },
            expected: {
                matchedPretext: '',
                groups: [
                    {key: 'ab', label: {}, suggestions: suggestions('a', 'b')},
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

    test('should not modify the given results', () => {
        const input: SuggestionResults = {
            matchedPretext: '',
            groups: [
                {key: 'abc', label: {}, suggestions: suggestions('a', 'b', 'c')},
                {key: 'def', label: {}, suggestions: suggestions('d', 'e', 'f')},
            ],
        };
        const before = cloneDeep(input);

        trimResults(input, max);

        expect(input).toEqual(before);
    });
});
