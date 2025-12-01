// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';

import FollowButton from './follow_button';

describe('components/threading/common/follow_button', () => {
    test('should say follow', async () => {
        const clickHandler = vi.fn();

        const {container} = renderWithContext(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        expect(container).toMatchSnapshot();

        const button = screen.getByText('Follow');
        expect(button).toBeInTheDocument();

        await userEvent.click(button);
        expect(clickHandler).toHaveBeenCalled();
    });

    test('should say following', () => {
        const {container} = renderWithContext(
            <FollowButton
                isFollowing={true}
            />,
        );

        expect(container).toMatchSnapshot();

        expect(screen.getByText('Following')).toBeInTheDocument();
    });

    test('should fire click handler', async () => {
        const clickHandler = vi.fn();

        renderWithContext(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        const button = screen.getByText('Follow');
        await userEvent.click(button);
        expect(clickHandler).toHaveBeenCalled();
    });
});
