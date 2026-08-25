// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SuggestionListContents from './suggestion_list_contents';
import {normalizeResultsFromProvider} from './suggestion_results';

const TestItem = (props: any) => (
    <li
        role='option'
        data-testid={`item-${props.term}`}
    >
        {props.term}
    </li>
);

const baseProps = {
    id: 'test-list',
    selectedTerm: '',
    getItemId: (term: string) => `suggestion-${term}`,
    onItemClick: jest.fn(),
    onItemHover: jest.fn(),
};

describe('SuggestionListContents', () => {
    describe('ungrouped results', () => {
        it('renders a listbox with one item per suggestion', () => {
            const results = normalizeResultsFromProvider({
                matchedPretext: '',
                terms: ['alice', 'bob'],
                items: [{}, {}],
                component: TestItem,
            });

            renderWithContext(
                <SuggestionListContents
                    {...baseProps}
                    results={results}
                />,
            );

            expect(screen.getByRole('listbox')).toBeInTheDocument();
            expect(screen.getAllByRole('option')).toHaveLength(2);
            expect(screen.getByTestId('item-alice')).toBeInTheDocument();
            expect(screen.getByTestId('item-bob')).toBeInTheDocument();
        });
    });

    describe('grouped results', () => {
        it('renders a listbox with one group per non-empty group', () => {
            const results = normalizeResultsFromProvider({
                matchedPretext: '',
                groups: [
                    {key: 'g1', terms: ['alice'], items: [{}], component: TestItem},
                    {key: 'g2', terms: ['bob'], items: [{}], component: TestItem},
                ],
            });

            renderWithContext(
                <SuggestionListContents
                    {...baseProps}
                    results={results}
                />,
            );

            expect(screen.getByRole('listbox')).toBeInTheDocument();
            expect(screen.getAllByRole('group')).toHaveLength(2);
            expect(screen.getByTestId('item-alice')).toBeInTheDocument();
            expect(screen.getByTestId('item-bob')).toBeInTheDocument();
        });

        it('renders a group label when provided', () => {
            const results = normalizeResultsFromProvider({
                matchedPretext: '',
                groups: [
                    {
                        key: 'g1',
                        label: {id: 'test.label', defaultMessage: 'Channel Members'},
                        terms: ['alice'],
                        items: [{}],
                        component: TestItem,
                    },
                ],
            });

            renderWithContext(
                <SuggestionListContents
                    {...baseProps}
                    results={results}
                />,
            );

            expect(screen.getByText('Channel Members')).toBeInTheDocument();
        });

        it('skips empty groups', () => {
            const results = normalizeResultsFromProvider({
                matchedPretext: '',
                groups: [
                    {key: 'empty', terms: [], items: [], component: TestItem},
                    {key: 'g2', terms: ['alice'], items: [{}], component: TestItem},
                ],
            });

            renderWithContext(
                <SuggestionListContents
                    {...baseProps}
                    results={results}
                />,
            );

            expect(screen.getAllByRole('group')).toHaveLength(1);
            expect(screen.getByTestId('item-alice')).toBeInTheDocument();
        });
    });
});
