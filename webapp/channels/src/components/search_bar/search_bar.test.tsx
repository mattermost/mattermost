// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import SearchChannelProvider from 'components/suggestion/search_channel_provider';
import SearchDateProvider from 'components/suggestion/search_date_provider';
import SearchUserProvider from 'components/suggestion/search_user_provider';

import en from 'i18n/en.json';
import {render} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import SearchBar from './search_bar';

import type {ComponentProps} from 'react';

const suggestionProviders = [
    new SearchDateProvider(),
    new SearchChannelProvider(jest.fn()),
    new SearchUserProvider(jest.fn()),
];

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => false),
    };
});

const wrapIntl = (component: JSX.Element) => (
    <IntlProvider
        locale={'en'}
        messages={en}
    >
        {component}
    </IntlProvider>
);

describe('components/search_bar/SearchBar', () => {
    const store = mockStore({});

    const wrapStore = (component: JSX.Element) => (
        <Provider store={store}>
            {component}
        </Provider>
    );

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
        const {container} = render(
            wrapStore(wrapIntl(<SearchBar {...baseProps}/>)),
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without search, without searchType', () => {
        const {container} = render(
            wrapStore(wrapIntl((
                <SearchBar {...baseProps}/>
            ))),
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without search, with searchType', () => {
        const {container} = render(
            wrapStore(wrapIntl((
                <SearchBar
                    {...baseProps}
                    searchType='files'
                />
            ))),
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with search, with searchType', () => {
        const {container} = render(
            wrapStore(wrapIntl((
                <SearchBar
                    {...baseProps}
                    searchTerms={'test'}
                    searchType='files'
                />
            ))),
        );
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with search', () => {
        const {container} = render(
            wrapStore(wrapIntl((
                <SearchBar
                    {...baseProps}
                    searchTerms={'test'}
                />
            ))),
        );
        expect(container).toMatchSnapshot();
    });
});
