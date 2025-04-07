// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
} from 'tests/react_testing_utils';

import SearchBoxSuggestions from './search_box_suggestions';

const TestProviderResultComponent = ({item, term, matchedPretext, isSelection, onClick, onMouseMove}: any) => {
    return (
        <div
            onClick={() => onClick(item.username, matchedPretext)}
            onMouseMove={() => onMouseMove()}
            className={isSelection ? 'selected' : ''}
        >
            <span>{item.username}</span>
            <span>{term}</span>
            <span>{matchedPretext}</span>
        </div>
    );
};

const TestPluginProviderComponent = ({searchTerms, onChangeSearch, onRunSearch}: any) => {
    return (
        <div>
            <span>{'Plugin suggestion'}</span>
            <span>{searchTerms}</span>
            <span onClick={() => onChangeSearch('test', 't')}>{'onChangeSearch'}</span>
            <span onClick={() => onRunSearch(searchTerms)}>{'onRunSearch'}</span>
        </div>
    );
};

describe('components/new_search/SearchBoxSuggestions', () => {
    const baseProps = {
        searchType: 'messages',
        searchTerms: '',
        searchTeam: 'teamId',
        selectedOption: -1,
        setSelectedOption: jest.fn(),
        suggestionsHeader: <p>{'Test Header'}</p>,
        providerResults: {
            matchedPretext: '',
            terms: ['user1', 'user2'],
            items: [{username: 'test-username1'}, {username: 'test-username2'}],
            component: TestProviderResultComponent,
        },
        onSearch: jest.fn(),
        onSuggestionSelected: jest.fn(),
    };

    test('should show the suggestions and the suggestion header on messages', () => {
        renderWithContext(<SearchBoxSuggestions {...baseProps}/>);
        expect(screen.getByText('Test Header')).toBeInTheDocument();
        expect(screen.getByText('test-username1')).toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('test-username2')).toBeInTheDocument();
        expect(screen.getByText('user2')).toBeInTheDocument();
    });

    test('should call the onSuggestionSelected on click', () => {
        renderWithContext(<SearchBoxSuggestions {...baseProps}/>);
        fireEvent.click(screen.getByText('test-username1'));
        expect(baseProps.onSuggestionSelected).toHaveBeenCalledWith('test-username1', '');
    });

    test('should call the onSuggestionSelected on click with matchedPretext and previous text', () => {
        const props = {...baseProps, searchTerms: 'something from:test-user', providerResults: {...baseProps.providerResults, matchedPretext: 'test-user'}};
        renderWithContext(<SearchBoxSuggestions {...props}/>);
        fireEvent.click(screen.getByText('test-username1'));
        expect(baseProps.onSuggestionSelected).toHaveBeenCalledWith('test-username1', 'test-user');
    });

    test('should change the selected option on mousemove', () => {
        const props = {...baseProps};
        renderWithContext(<SearchBoxSuggestions {...props}/>);
        fireEvent.mouseMove(screen.getByText('test-username2'));
        expect(baseProps.setSelectedOption).toHaveBeenCalledWith(1);
        fireEvent.mouseMove(screen.getByText('test-username1'));
        expect(baseProps.setSelectedOption).toHaveBeenCalledWith(0);
    });

    test('should not show the plugin suggestions without license', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'test-search-terms'};
        renderWithContext(
            <SearchBoxSuggestions {...props}/>,
            {
                plugins: {components: {SearchSuggestions: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'false'}}},
            },
        );
        expect(screen.queryByText('Plugin suggestion')).not.toBeInTheDocument();
        expect(screen.queryByText('test-search-terms')).not.toBeInTheDocument();
    });

    test('should show the plugin suggestions', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'test-search-terms'};
        renderWithContext(
            <SearchBoxSuggestions {...props}/>,
            {
                plugins: {components: {SearchSuggestions: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        expect(screen.getByText('Plugin suggestion')).toBeInTheDocument();
        expect(screen.getByText('test-search-terms')).toBeInTheDocument();
    });

    test('should call the onSuggestionSelected on plugin search change', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'something from:t'};
        renderWithContext(
            <SearchBoxSuggestions {...props}/>,
            {
                plugins: {components: {SearchSuggestions: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        screen.getByText('onChangeSearch').click();
        expect(baseProps.onSuggestionSelected).toHaveBeenCalledWith('test', 't');
    });

    test('should run search whenver onRunSearch is executed', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'something from:t'};
        renderWithContext(
            <SearchBoxSuggestions {...props}/>,
            {
                plugins: {components: {SearchSuggestions: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        screen.getByText('onRunSearch').click();
        expect(baseProps.onSearch).toHaveBeenCalledWith('test-id', 'teamId', 'something from:t');
    });
});
