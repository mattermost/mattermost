// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor, within} from '@testing-library/react';
import mergeWith from 'lodash/mergeWith';
import React from 'react';

import {getMoreFlaggedPosts} from 'actions/views/rhs';

import SavedMessages from 'components/saved_messages/saved_messages';

import {renderWithContext} from 'tests/react_testing_utils';
import {popoutRhsSearch} from 'utils/popouts/popout_windows';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/views/rhs', () => ({
    getMoreFlaggedPosts: jest.fn(() => ({type: 'MOCK_GET_MORE_FLAGGED_POSTS'})),
}));

jest.mock('utils/popouts/popout_windows', () => ({
    popoutRhsSearch: jest.fn(),
    canPopout: () => true,
}));

jest.mock('components/search_results/post_search_results_item', () => ({
    __esModule: true,
    default: (props: {post: {id: string}}) => <div data-testid='saved-post'>{props.post.id}</div>,
}));

jest.mock('components/search_results_header', () => ({
    __esModule: true,
    default: (props: {newWindowHandler?: () => void; children: React.ReactNode}) => (
        <div>
            {props.children}
            <button
                data-testid='popout-button'
                onClick={props.newWindowHandler}
            />
        </div>
    ),
}));

describe('components/SavedMessages', () => {
    const team = TestHelper.getTeamMock({id: 'team1', name: 'team-name'});
    const older = TestHelper.getPostMock({id: 'older', create_at: 1000});
    const newer = TestHelper.getPostMock({id: 'newer', create_at: 2000});

    const baseState = {
        entities: {
            posts: {posts: {older, newer}},
            search: {
                flagged: ['older', 'newer'],
                flaggedPaging: {page: 0, isEnd: true},
                isSearchGettingMore: false,
            },
            teams: {currentTeamId: team.id, teams: {[team.id]: team}},
            users: {currentUserId: 'user1', profiles: {user1: TestHelper.getUserMock({id: 'user1'})}},
        },
        views: {
            rhs: {isSearchingFlaggedPost: false, searchTeam: team.id},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function stateWith(overrides: object) {
        return mergeWith({}, baseState, overrides, (_, value) => (Array.isArray(value) ? value : undefined));
    }

    test('should list saved messages newest first', () => {
        renderWithContext(<SavedMessages/>, baseState);

        expect(screen.getAllByTestId('saved-post').map((el) => el.textContent)).toEqual(['newer', 'older']);
    });

    test('should skip saved messages whose posts are not loaded', () => {
        renderWithContext(<SavedMessages/>, stateWith({entities: {search: {flagged: ['missing', 'newer']}}}));

        expect(screen.getAllByTestId('saved-post').map((el) => el.textContent)).toEqual(['newer']);
    });

    test('should show the empty state when there are no saved messages', () => {
        renderWithContext(<SavedMessages/>, stateWith({entities: {search: {flagged: []}}}));

        expect(screen.queryByTestId('saved-post')).toBeNull();
        expect(screen.getByText('No saved messages yet')).toBeInTheDocument();
    });

    test('should keep loading instead of showing the empty state while more saved messages follow', async () => {
        const {container} = renderWithContext(
            <SavedMessages/>,
            stateWith({entities: {search: {flagged: [], flaggedPaging: {isEnd: false}}}}),
        );

        expect(screen.queryByText('No saved messages yet')).toBeNull();
        expect(container.querySelector('.loading-screen')).not.toBeNull();
        await waitFor(() => expect(getMoreFlaggedPosts).toHaveBeenCalled());
    });

    test('should not load more at the end of the list', async () => {
        const {container} = renderWithContext(<SavedMessages/>, baseState);

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(getMoreFlaggedPosts).not.toHaveBeenCalled();
        expect(container.querySelector('.loading-screen')).toBeNull();
    });

    test('should not load more while the first page is loading', async () => {
        renderWithContext(
            <SavedMessages/>,
            stateWith({entities: {search: {flaggedPaging: {isEnd: false}}}, views: {rhs: {isSearchingFlaggedPost: true}}}),
        );

        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(getMoreFlaggedPosts).not.toHaveBeenCalled();
    });

    test('should open saved messages in a popout', () => {
        const {container} = renderWithContext(<SavedMessages/>, baseState);
        within(container).getByTestId('popout-button').click();

        expect(jest.mocked(popoutRhsSearch)).toHaveBeenCalledWith(
            expect.any(String), team.name, '', 'flag', 'messages', undefined, team.id,
        );
    });
});
