// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SidebarBaseChannel from 'components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/sidebar/sidebar_channel/sidebar_channel_link', () => {
    return ({label, link, ariaLabelPrefix}: {label: string; link: string; ariaLabelPrefix?: string}) => (
        <a
            href={link}
            aria-label={`${label} ${ariaLabelPrefix}`.toLowerCase()}
        >
            {label}
        </a>
    );
});

describe('components/sidebar/sidebar_channel/sidebar_base_channel for a board', () => {
    const actions = {
        leaveChannel: jest.fn(),
        openModal: jest.fn(),
    };

    test('names a public board a public board', () => {
        renderWithContext(
            <SidebarBaseChannel
                channel={TestHelper.getChannelMock({id: 'board1', display_name: 'Roadmap', type: 'O'})}
                currentTeamName='team_name'
                actions={actions}
            />,
            boardChannelsState('board1'),
        );

        expect(screen.getByRole('link', {name: 'roadmap public board'})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /channel/})).not.toBeInTheDocument();
    });

    test('names a private board a private board', () => {
        renderWithContext(
            <SidebarBaseChannel
                channel={TestHelper.getChannelMock({id: 'board1', display_name: 'Roadmap', type: 'P'})}
                currentTeamName='team_name'
                actions={actions}
            />,
            boardChannelsState('board1'),
        );

        expect(screen.getByRole('link', {name: 'roadmap private board'})).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /channel/})).not.toBeInTheDocument();
    });
});
