// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {
    renderWithContext,
    screen,
    fireEvent,
} from 'tests/react_testing_utils';

import SearchBoxHints from './search_box_hints';

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

const TestPluginProviderComponent = ({searchTerms, onChangeSearch}: any) => {
    return (
        <div>
            <span>{'Plugin suggestion'}</span>
            <span>{searchTerms}</span>
            <span onClick={() => onChangeSearch('test', 't')}>{'onChangeSearch'}</span>
        </div>
    );
};

describe('components/new_search/SearchBoxHints', () => {
    const baseProps = {
        searchType: 'messages',
        searchTerms: '',
        searchTeam: 'teamId',
        showFilterHaveBeenReset: false,
        setSearchTerms: jest.fn(),
        focus: jest.fn(),
        selectedOption: -1,
        providerResults: {
            matchedPretext: '',
            terms: ['user1', 'user2'],
            items: [{username: 'test-username1'}, {username: 'test-username2'}],
            component: TestProviderResultComponent,
        },
    };

    test('should show the hints for messages', () => {
        renderWithContext(<SearchBoxHints {...baseProps}/>);
        expect(screen.getByText('From:')).toBeInTheDocument();
    });

    test('should change the search term and focus on click', () => {
        renderWithContext(<SearchBoxHints {...baseProps}/>);
        fireEvent.click(screen.getByText('From:'));
        expect(baseProps.setSearchTerms).toHaveBeenCalledWith('From:');
        expect(baseProps.focus).toHaveBeenCalledWith(5);
    });

    test('should set the selected option if it is passed from the parent', () => {
        const props = {...baseProps, selectedOption: 1};
        renderWithContext(<SearchBoxHints {...props}/>);
        expect(screen.getByText('Press Enter to select')).toBeInTheDocument();
    });

    test('should not show the plugin suggestions without license', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'test-search-terms'};
        renderWithContext(
            <SearchBoxHints {...props}/>,
            {
                plugins: {components: {SearchHints: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'false'}}},
            },
        );
        expect(screen.queryByText('Plugin suggestion')).not.toBeInTheDocument();
        expect(screen.queryByText('test-search-terms')).not.toBeInTheDocument();
    });

    test('should show the plugin suggestions', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'test-search-terms'};
        renderWithContext(
            <SearchBoxHints {...props}/>,
            {
                plugins: {components: {SearchHints: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        expect(screen.getByText('Plugin suggestion')).toBeInTheDocument();
        expect(screen.getByText('test-search-terms')).toBeInTheDocument();
    });

    test('should on search change change the search term and focus', () => {
        const props = {...baseProps, searchType: 'test-id', searchTerms: 'something from:t'};
        renderWithContext(
            <SearchBoxHints {...props}/>,
            {
                plugins: {components: {SearchHints: [{component: TestPluginProviderComponent as React.ComponentType, pluginId: 'test-id'}]}},
                entities: {general: {license: {IsLicensed: 'true'}}},
            },
        );
        screen.getByText('onChangeSearch').click();
        expect(baseProps.setSearchTerms).toHaveBeenCalledWith('something from:test ');
        expect(baseProps.focus).toHaveBeenCalledWith(20);
    });
});
