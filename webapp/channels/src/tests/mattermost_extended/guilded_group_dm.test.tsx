// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('canvas', () => ({
    createCanvas: () => ({
        getContext: () => ({}),
    }),
}));

import {render, screen, fireEvent} from '@testing-library/react';
import {useSelector, useDispatch} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';

import EnhancedGroupDmRow from 'components/enhanced_group_dm_row';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

jest.mock('react-redux', () => ({
    useSelector: jest.fn(),
    useDispatch: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getMyChannelMember: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/teams', () => ({
    getCurrentRelativeTeamUrl: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/users', () => ({
    getCurrentUserId: jest.fn(),
    getUser: jest.fn(),
}));

jest.mock('selectors/views/guilded_layout', () => ({
    getLastPostInChannel: jest.fn(),
}));

describe('Guilded Group DM', () => {
    const mockChannel = {
        id: 'channel_id_1',
        name: 'user1_user2_user3',
        display_name: 'User 1, User 2',
        type: 'G',
    };
    const mockUsers = [
        {id: 'user_1', username: 'user1', last_picture_update: 123},
        {id: 'user_2', username: 'user2', last_picture_update: 456},
    ];

    it('EnhancedGroupDmRow should use relative team URL and /messages/ route', () => {
        (getCurrentRelativeTeamUrl as jest.Mock).mockReturnValue('/my-team');
        (useSelector as jest.Mock).mockImplementation((selector) => {
            if (selector === getCurrentRelativeTeamUrl) {
                return '/my-team';
            }
            return null;
        });

        render(
            <BrowserRouter>
                <EnhancedGroupDmRow
                    channel={mockChannel as any}
                    users={mockUsers as any}
                    isActive={false}
                />
            </BrowserRouter>
        );

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', '/my-team/messages/user1_user2_user3');
    });
});
