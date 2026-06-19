// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import MoveWikiModal from 'components/move_wiki_modal/move_wiki_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/MoveWikiModal', () => {
    const baseState = {
        entities: {
            general: {
                config: {},
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {
                        id: 'team1',
                        name: 'team1',
                    },
                },
            },
            channels: {
                myMembers: {
                    channel1: {channel_id: 'channel1', user_id: 'user1'},
                    channel2: {channel_id: 'channel2', user_id: 'user1'},
                },
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team1',
                        display_name: 'Current Channel',
                        name: 'current-channel',
                        delete_at: 0,
                        type: 'O' as ChannelType,
                    },
                    channel2: {
                        id: 'channel2',
                        team_id: 'team1',
                        display_name: 'Target Channel',
                        name: 'target-channel',
                        delete_at: 0,
                        type: 'O' as ChannelType,
                    },
                },
                channelsInTeam: {
                    team1: new Set(['channel1', 'channel2']),
                },
            },
            users: {
                currentUserId: 'user1',
            },
        },
    };

    const baseProps = {
        wikiTitle: 'Test Wiki',
        currentChannelId: 'channel1',
        onConfirm: jest.fn().mockResolvedValue(undefined),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Move Wiki to Another Channel')).toBeInTheDocument();
    });

    test('should display wiki title in description', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        expect(screen.getByText(/Test Wiki/)).toBeInTheDocument();
    });

    test('should have confirm button text', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        expect(screen.getByText('Move Wiki')).toBeInTheDocument();
    });

    test('should display channel selector', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        expect(screen.getByLabelText('Target Channel')).toBeInTheDocument();
    });

    test('should have placeholder option in selector', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        expect(screen.getByText('Select a channel...')).toBeInTheDocument();
    });

    test('should have confirm button disabled when no channel selected', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        const confirmButton = screen.getByText('Move Wiki');
        expect(confirmButton).toBeDisabled();
    });

    test('should call onCancel when Cancel button is clicked', () => {
        renderWithContext(<MoveWikiModal {...baseProps}/>, baseState);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalled();
    });
});
