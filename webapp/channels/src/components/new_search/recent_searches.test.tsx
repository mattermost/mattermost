// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {RecentSearch} from '@mattermost/types/search';
import type {Team} from '@mattermost/types/teams';

import {
    renderWithContext,
    screen,
    userEvent,
} from 'tests/react_testing_utils';

import RecentSearches from './recent_searches';

const team: Team = {id: 'team1', name: 'team1', display_name: 'Team 1', description: ''} as Team;

function makeItem(overrides: Partial<RecentSearch> = {}): RecentSearch {
    return {
        id: 'id1',
        user_id: 'user1',
        terms: 'hello from:me',
        search_type: 'messages',
        team_id: 'team1',
        create_at: 1,
        update_at: 2,
        ...overrides,
    };
}

describe('components/new_search/RecentSearches', () => {
    const onSearch = jest.fn();

    beforeEach(() => {
        onSearch.mockClear();
    });

    test('hides when empty', () => {
        const {container} = renderWithContext(
            <RecentSearches
                onSearch={onSearch}
                myTeams={[team]}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders newest first and limits to five', () => {
        const items = [
            makeItem({id: 'a', terms: 'first', update_at: 50}),
            makeItem({id: 'b', terms: 'second', update_at: 40}),
            makeItem({id: 'c', terms: 'third', update_at: 30}),
            makeItem({id: 'd', terms: 'fourth', update_at: 20}),
            makeItem({id: 'e', terms: 'fifth', update_at: 10}),
            makeItem({id: 'f', terms: 'sixth', update_at: 1}),
        ];

        renderWithContext(
            <RecentSearches
                onSearch={onSearch}
                myTeams={[team]}
            />,
            {entities: {search: {recentSearches: items}}},
        );

        expect(screen.getByText('first')).toBeInTheDocument();
        expect(screen.getByText('fifth')).toBeInTheDocument();
        expect(screen.queryByText('sixth')).not.toBeInTheDocument();
    });

    test('reruns through onSearch and keeps operators', async () => {
        renderWithContext(
            <RecentSearches
                onSearch={onSearch}
                myTeams={[team]}
            />,
            {entities: {search: {recentSearches: [makeItem()]}}},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Search again: hello from:me'}));
        expect(onSearch).toHaveBeenCalledWith('messages', 'team1', 'hello from:me');
    });

    test('shows an error and does not search when the stored team is missing', async () => {
        renderWithContext(
            <RecentSearches
                onSearch={onSearch}
                myTeams={[team]}
            />,
            {entities: {search: {recentSearches: [makeItem({team_id: 'gone'})]}}},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Search again: hello from:me'}));
        expect(onSearch).not.toHaveBeenCalled();
        expect(screen.getByText('That team is no longer available')).toBeInTheDocument();
    });

    test('clear does not search', async () => {
        renderWithContext(
            <RecentSearches
                onSearch={onSearch}
                myTeams={[team]}
            />,
            {entities: {search: {recentSearches: [makeItem()]}}},
        );

        await userEvent.click(screen.getByRole('button', {name: 'Clear hello from:me'}));
        expect(onSearch).not.toHaveBeenCalled();
    });

    test('Escape still closes the parent popover', async () => {
        const onClose = jest.fn();
        renderWithContext(
            <div
                onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                        onClose();
                    }
                }}
            >
                <RecentSearches
                    onSearch={onSearch}
                    myTeams={[team]}
                />
            </div>,
            {entities: {search: {recentSearches: [makeItem()]}}},
        );

        screen.getByRole('button', {name: 'Search again: hello from:me'}).focus();
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
    });
});
