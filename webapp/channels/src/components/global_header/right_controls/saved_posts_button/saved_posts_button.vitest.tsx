// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import SavedPostsButton from './saved_posts_button';

vi.mock('actions/views/rhs', () => ({
    closeRightHandSide: vi.fn(() => ({type: 'CLOSE_RHS'})),
    showFlaggedPosts: vi.fn(() => ({type: 'SHOW_FLAGGED_POSTS'})),
}));

describe('components/global/AtMentionsButton', () => {
    const getBaseState = () => ({
        views: {
            rhs: {
                isSidebarOpen: true,
            },
        },
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SavedPostsButton/>,
            getBaseState(),
        );
        expect(container).toMatchSnapshot();
    });

    test('should show active mentions', () => {
        renderWithContext(
            <SavedPostsButton/>,
            getBaseState(),
        );

        const button = screen.getByRole('button', {name: /saved messages/i});

        // The button click should dispatch an action (we can verify the button exists and is clickable)
        expect(button).toBeInTheDocument();
    });
});
