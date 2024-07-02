// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    renderWithContext,
    screen,
} from 'tests/react_testing_utils';
import React from 'react';

import SearchHint from './search_hint';

describe('components/new_search/SearchHint', () => {
    const baseProps = {
        onSelectFilter: jest.fn(),
        searchType: 'messages',
        searchTerms: '',
        hasSelectedOption: false,
        isDate: false,
    };

    test('should match snapshot on search messages empty string', () => {
        renderWithContext(<SearchHint {...baseProps}/>)
        expect(screen.getByText("From:")).toBeInTheDocument();
        expect(screen.queryByText("Ext:")).not.toBeInTheDocument();
    });

    test('should match snapshot on search messages with not empty string not ended with space', () => {
        const props = {...baseProps, searchTerms: 'test'};
        renderWithContext(<SearchHint {...props}/>)
        expect(screen.getByText("Press Enter to search")).toBeInTheDocument();
    });

    test('should match snapshot on search messages with not empty string ended with space', () => {
        const props = {...baseProps, searchTerms: 'test '};
        renderWithContext(<SearchHint {...props}/>)
        expect(screen.getByText("From:")).toBeInTheDocument();
        expect(screen.queryByText("Ext:")).not.toBeInTheDocument();
    });

    test('should match snapshot on search files empty string', () => {
        const props = {...baseProps, searchType: 'files'};
        renderWithContext(<SearchHint {...props}/>)
        expect(screen.getByText("From:")).toBeInTheDocument();
        expect(screen.queryByText("Ext:")).toBeInTheDocument();
    });

    test('should match snapshot on search files with not empty string not ended with space', () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test'};
        renderWithContext(<SearchHint {...props}/>)
        expect(screen.getByText("Press Enter to search")).toBeInTheDocument();
    });

    test('should match snapshot on search files with not empty string ended with space', () => {
        const props = {...baseProps, searchType: 'files', searchTerms: 'test '};
        renderWithContext(<SearchHint {...props}/>)
        expect(screen.getByText("From:")).toBeInTheDocument();
        expect(screen.getByText("Ext:")).toBeInTheDocument();
    });

    test('should match snapshot on search if is date', () => {
        const props = {...baseProps, isDate: true};
        const { asFragment } = renderWithContext(<SearchHint {...props}/>)
        expect(asFragment()).toMatchInlineSnapshot(`<DocumentFragment />`);
    });

    test('should match snapshot on search if has selected option', () => {
        const props = {...baseProps, hasSelectedOption: true};
        renderWithContext(<SearchHint {...props}/>);
        expect(screen.getByText("Press Enter to select")).toBeInTheDocument();
    });

    test('on filter clicked should call the onSelectFilter', () => {
        renderWithContext(<SearchHint {...baseProps}/>);
        screen.getByText('From:').click();
        expect(baseProps.onSelectFilter).toHaveBeenCalledWith('From:');
    });
});
