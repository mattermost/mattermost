// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {render} from 'tests/react_testing_utils';

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
            fetchRemoteClusterInfo: jest.fn(),
        },
        dispatch: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = render(<UserProfile {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with colorization', () => {
        const props = {
            ...baseProps,
            colorize: true,
        };

        const {container} = render(<UserProfile {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when user is shared', () => {
        const props = {
            ...baseProps,
            isShared: true,
        };

        const {container} = render(<UserProfile {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when popover is disabled', () => {
        const {container} = render(
            <UserProfile
                {...baseProps}
                disablePopover={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when displayUsername is enabled', () => {
        const {container} = render(
            <UserProfile
                {...baseProps}
                displayUsername={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
