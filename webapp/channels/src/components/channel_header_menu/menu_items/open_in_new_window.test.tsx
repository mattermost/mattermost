// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {isChannelPopoutWindow, popoutChannel} from 'utils/popouts/popout_windows';
import {TestHelper} from 'utils/test_helper';

import MenuItemOpenInNewWindow from './open_in_new_window';

jest.mock('components/channel_popout/channel_popout', () => ({
    getPopoutChannelTitle: jest.fn(() => ({id: 'test.title', defaultMessage: 'Test Title'})),
}));

jest.mock('utils/popouts/popout_windows', () => ({
    isChannelPopoutWindow: jest.fn(() => false),
    popoutChannel: jest.fn(),
    canPopout: jest.fn(() => true),
}));

describe('MenuItemOpenInNewWindow', () => {
    const currentUser = TestHelper.getUserMock({id: 'current_user_id', username: 'currentuser'});
    const team = TestHelper.getTeamMock({id: 'team_id', name: 'test-team'});

    const baseState = {
        entities: {
            channels: {
                currentChannelId: 'channel_id',
                channels: {},
                channelsInTeam: {},
                myMembers: {},
            },
            teams: {
                currentTeamId: team.id,
                teams: {[team.id]: team},
                myMembers: {},
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            general: {config: {}},
            preferences: {myPreferences: {}},
            roles: {roles: {}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(isChannelPopoutWindow).mockReturnValue(false);
    });

    test('should render nothing when already in a channel popout', () => {
        jest.mocked(isChannelPopoutWindow).mockReturnValue(true);
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, name: 'town-square'});

        const {container} = renderWithContext(
            <WithTestMenuContext>
                <MenuItemOpenInNewWindow channel={channel}/>
            </WithTestMenuContext>,
            baseState,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('should call popoutChannel when clicked', async () => {
        const channel = TestHelper.getChannelMock({type: 'O' as ChannelType, name: 'town-square'});

        renderWithContext(
            <WithTestMenuContext>
                <MenuItemOpenInNewWindow channel={channel}/>
            </WithTestMenuContext>,
            baseState,
        );

        await userEvent.click(screen.getByText('Open in new window'));

        expect(jest.mocked(popoutChannel)).toHaveBeenCalledWith(
            expect.any(String),
            'test-team',
            'channels',
            'town-square',
        );
    });
});
