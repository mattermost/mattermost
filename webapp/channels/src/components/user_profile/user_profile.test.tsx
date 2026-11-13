// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {render, screen} from 'tests/react_testing_utils';

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

    test('should render ImportedInactiveTag for imported inactive user', () => {
        const props = {
            ...baseProps,
            user: {username: 'username', props: {importedInactive: 'true'}} as unknown as UserProfileType,
        };
        render(<UserProfile {...props}/>);
        expect(screen.getByText('IMPORTED - INACTIVE')).toBeInTheDocument();
    });

    test('should not render ImportedInactiveTag for regular user', () => {
        render(<UserProfile {...baseProps}/>);
        expect(screen.queryByText('IMPORTED - INACTIVE')).not.toBeInTheDocument();
    });
});
