// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {showFlaggedPosts} from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import SavedPostsButton from './saved_posts_button';

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
    showFlaggedPosts: jest.fn(() => ({type: 'MOCK_SHOW_FLAGGED_POSTS'})),
}));

describe('components/global/AtMentionsButton', () => {
    const initialState = {
        views: {
            rhs: {
                isSidebarOpen: true,
            },
        },
    } as unknown as GlobalState;

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SavedPostsButton/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show active mentions', async () => {
        renderWithContext(
            <SavedPostsButton/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Saved messages'}));
        expect(showFlaggedPosts).toHaveBeenCalledTimes(1);
    });
});
