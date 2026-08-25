// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SuggestionDate from './suggestion_date';
import {emptyResults, normalizeResultsFromProvider} from './suggestion_results';

jest.mock('components/widgets/popover', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='popover'>{children}</div>,
}));

const noop = jest.fn();

describe('SuggestionDate', () => {
    it('renders nothing when there are no results', () => {
        const {container} = renderWithContext(
            <SuggestionDate
                results={emptyResults()}
                matchedPretext=''
                onCompleteWord={noop}
                preventClose={noop}
                handleEscape={noop}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders the suggestion component inside a popover', () => {
        const TestDateItem = (props: any) => <div data-testid='date-item'>{props.term}</div>;

        const results = normalizeResultsFromProvider({
            matchedPretext: '',
            terms: ['2024-01-15'],
            items: [{date: '2024-01-15', label: 'January 15'}],
            component: TestDateItem,
        });

        renderWithContext(
            <SuggestionDate
                results={results}
                matchedPretext=''
                onCompleteWord={noop}
                preventClose={noop}
                handleEscape={noop}
            />,
        );

        expect(screen.getByTestId('popover')).toBeInTheDocument();
        expect(screen.getByTestId('date-item')).toBeInTheDocument();
    });
});
