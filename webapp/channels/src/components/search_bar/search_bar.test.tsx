// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';

import {renderWithContext} from 'tests/react_testing_utils';

import SearchBar from './search_bar';

const suggestionProviders = [
    new SearchDateProvider(),
    new SearchChannelProvider(jest.fn()),
    new SearchUserProvider(jest.fn()),
];

describe('components/search_bar/SearchBar', () => {
    const baseProps: ComponentProps<typeof SearchBar> = {
        suggestionProviders,
        searchTerms: '',
        keepFocused: false,
        setKeepFocused: jest.fn(),
        isFocused: false,
        isSideBarRight: false,
        isSearchingTerm: false,
        searchType: '',
        clearSearchType: jest.fn(),
        children: null,
        updateHighlightedSearchHint: jest.fn(),
        handleChange: jest.fn(),
        handleSubmit: jest.fn(),
        handleEnterKey: jest.fn(),
        handleClear: jest.fn(),
        handleFocus: jest.fn(),
        handleBlur: jest.fn(),
    };

    it('should match snapshot without search', () => {
        const {container} = renderWithContext(
            <SearchBar {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without search, without searchType', () => {
        const {container} = renderWithContext(
            <SearchBar {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without search, with searchType', () => {
        const {container} = renderWithContext(
            <SearchBar
                {...baseProps}
                searchType='files'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with search, with searchType', () => {
        const {container} = renderWithContext(
            <SearchBar
                {...baseProps}
                searchTerms={'test'}
                searchType='files'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with search', () => {
        const {container} = renderWithContext(
            <SearchBar
                {...baseProps}
                searchTerms={'test'}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
