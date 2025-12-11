// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import UserProfile from './user_profile';

describe('components/UserProfile', () => {
    const baseProps = {
        displayName: 'nickname',
        isBusy: false,
        isMobileView: false,
        user: {username: 'username'} as UserProfileType,
        userId: 'user_id',
        theme: Preferences.THEMES.onyx,
        isShared: false,
        remoteNames: [],
        actions: {
            fetchRemoteClusterInfo: vi.fn(),
        },
        dispatch: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(<UserProfile {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with colorization', () => {
        const props = {
            ...baseProps,
            colorize: true,
        };

        const {container} = renderWithIntl(<UserProfile {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when user is shared', () => {
        const props = {
            ...baseProps,
            isShared: true,
        };

        const {container} = renderWithIntl(<UserProfile {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when popover is disabled', () => {
        const {container} = renderWithIntl(
            <UserProfile
                {...baseProps}
                disablePopover={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when displayUsername is enabled', () => {
        const {container} = renderWithIntl(
            <UserProfile
                {...baseProps}
                displayUsername={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
