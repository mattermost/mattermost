// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserProfile from './user_profile';

describe('components/UserProfile', () => {
    const user = TestHelper.getUserMock({username: 'testUserName', nickname: 'testNickname', first_name: 'testFirstName', last_name: 'testLastName'});
    const displayName = `${user.first_name} ${user.last_name}`;

    const baseProps = {
        displayName,
        isBusy: false,
        isMobileView: false,
        user,
        userId: 'user_id',
        theme: Preferences.THEMES.onyx,
        isShared: false,
        dispatch: jest.fn(),
    };

    test('renders basic user profile with nickname', () => {
        renderWithContext(
            <UserProfile {...baseProps}/>,
        );

        // The profile should be rendered as a button due to the popover
        const profileButton = screen.getByRole('button', {name: displayName});
        expect(profileButton).toBeInTheDocument();
        expect(profileButton).toHaveClass('user-popover');
    });

    test('renders with colorization', () => {
        renderWithContext(
            <UserProfile
                {...baseProps}
                colorize={true}
            />,
        );

        const profileButton = screen.getByRole('button', {name: displayName});

        // Check if the element has a color style property
        const styles = window.getComputedStyle(profileButton);
        expect(styles.color).toBeDefined();
    });

    test('renders shared user indicator when user is shared', () => {
        const sharedUser = {
            ...baseProps.user,
            remote_id: 'remote_id', // This makes the user a shared user
        };

        renderWithContext(
            <UserProfile
                {...baseProps}
                user={sharedUser}
            />,
        );

        // Check for shared user indicator by its icon class
        expect(screen.getByLabelText('shared user indicator')).toBeInTheDocument();
    });

    test('renders without popover when disabled', () => {
        renderWithContext(
            <UserProfile
                {...baseProps}
                disablePopover={true}
            />,
        );

        // When popover is disabled, it should render as a div instead of a button
        const profileDiv = screen.getByText(displayName);
        expect(profileDiv.tagName).toBe('DIV');
        expect(profileDiv).toHaveClass('user-popover');
    });

    test('renders username when displayUsername is enabled', () => {
        renderWithContext(
            <UserProfile
                {...baseProps}
                displayUsername={true}
            />,
        );

        // Should show the username with @ prefix
        const profileButton = screen.getByRole('button', {name: `@${user.username}`});
        expect(profileButton).toBeInTheDocument();
    });

    test('renders bot tag for bot users', () => {
        const botUser = {
            ...baseProps.user,
            is_bot: true,
        };

        renderWithContext(
            <UserProfile
                {...baseProps}
                user={botUser}
            />,
        );

        expect(screen.getByText('BOT')).toBeInTheDocument();
    });

    test('renders guest tag for guest users', () => {
        const guestUser = {
            ...baseProps.user,
            roles: 'system_guest',
        };

        renderWithContext(
            <UserProfile
                {...baseProps}
                user={guestUser}
            />,
        );

        expect(screen.getByText('GUEST')).toBeInTheDocument();
    });
});
