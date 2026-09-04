// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {showMentions} from 'actions/views/rhs';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import AtMentionsButton from './at_mentions_button';

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
    showMentions: jest.fn(() => ({type: 'MOCK_SHOW_MENTIONS'})),
}));

describe('components/global/AtMentionsButton', () => {
    const initialState = {
        views: {
            rhs: {
                isSidebarOpen: true,
                platformNotifications: [],
            },
        },
    } as unknown as GlobalState;

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AtMentionsButton/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should show active mentions', async () => {
        renderWithContext(
            <AtMentionsButton/>,
            initialState,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Recent mentions'}));
        expect(showMentions).toHaveBeenCalledTimes(1);
    });

    test('shows an unread badge when Activity has unread notifications', () => {
        renderWithContext(
            <AtMentionsButton/>,
            {
                views: {
                    rhs: {
                        isSidebarOpen: true,
                        platformNotifications: [{
                            id: 'n1',
                            recordedAt: 100,
                            postId: 'post1',
                            channelId: 'channel1',
                            teamId: 'team1',
                            channelDisplayName: 'Town Square',
                            contextLabel: 'Mention',
                            permalinkUrl: '/permalink',
                            isThreadReply: false,
                            previewBody: '@alice: hello',
                        }],
                    },
                },
            } as unknown as GlobalState,
        );

        expect(document.querySelector('.HeaderIconButton__unread')).toBeInTheDocument();
    });
});
