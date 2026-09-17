// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FollowButton from './follow_button';

describe('components/threading/common/follow_button', () => {
    test('should say follow', async () => {
        const clickHandler = jest.fn();

        const {container} = renderWithContext(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        expect(container).toMatchSnapshot();

        expect(screen.getByText('Follow')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button'));
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

    test('as an icon button, uses the Compass bell off/on glyphs', async () => {
        const {rerender} = renderWithContext(
            <FollowButton
                isFollowing={false}
                iconOnly={true}
            />,
        );

        const offButton = screen.getByRole('button', {name: 'Follow'});
        expect(offButton).toHaveAttribute('aria-pressed', 'false');
        expect(offButton.querySelector('.icon-bell-off-outline')).toBeInTheDocument();
        expect(screen.queryByText('Follow')).not.toBeInTheDocument();

        rerender(
            <FollowButton
                isFollowing={true}
                iconOnly={true}
            />,
        );

        const onButton = screen.getByRole('button', {name: 'Following'});
        expect(onButton).toHaveAttribute('aria-pressed', 'true');
        expect(onButton).toHaveClass('btn-force-active');
        expect(onButton.querySelector('.icon-bell-outline')).toBeInTheDocument();
        expect(onButton.querySelector('.icon-bell-off-outline')).not.toBeInTheDocument();
    });

    test('should fire click handler', async () => {
        const clickHandler = jest.fn();

        renderWithContext(
            <FollowButton
                isFollowing={false}
                onClick={clickHandler}
            />,
        );

        await userEvent.click(screen.getByRole('button'));
        expect(clickHandler).toHaveBeenCalled();
    });
});
