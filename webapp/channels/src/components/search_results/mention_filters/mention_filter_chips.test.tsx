// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {defaultMentionFilters} from 'utils/mention_search';

import type {MentionFilters} from 'types/store/rhs';

import MentionFilterChips from './mention_filter_chips';

const mockDispatch = jest.fn();

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

jest.mock('actions/views/rhs', () => ({
    updateMentionFilters: (filters: MentionFilters, teamId: string | null) => ({type: 'MOCK_UPDATE_MENTION_FILTERS', filters, teamId}),
}));

function baseState(filters: MentionFilters, searchTeam: string | null) {
    return {
        entities: {
            channels: {
                channels: {
                    channel1: {id: 'channel1', team_id: 'team1', display_name: 'Release Coordination', name: 'release-coordination', type: 'O' as const, delete_at: 0},
                },
                channelsInTeam: {team1: new Set(['channel1'])},
                myMembers: {channel1: {channel_id: 'channel1', user_id: 'user1'}},
            },
            teams: {
                currentTeamId: 'team1',
                teams: {team1: {id: 'team1', display_name: 'Product'}},
            },
        },
        views: {
            rhs: {
                mentionFilters: filters,
                searchTeam,
            },
        },
    };
}

describe('MentionFilterChips', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
    });

    test('renders nothing when no filter is applied', () => {
        renderWithContext(<MentionFilterChips/>, baseState(defaultMentionFilters, null));

        expect(screen.queryByTestId('mentionFilterChips')).not.toBeInTheDocument();
    });

    test('shows a chip per applied filter', () => {
        renderWithContext(
            <MentionFilterChips/>,
            baseState({channelIds: ['channel1'], mentionTypes: ['direct'], date: 'today'}, 'team1'),
        );

        expect(screen.getByText('Product')).toBeInTheDocument();
        expect(screen.getByText('Release Coordination')).toBeInTheDocument();
        expect(screen.getByText('Directly mentioning you')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
    });

    test('names the channel\'s team when the search spans every team', async () => {
        renderWithContext(
            <MentionFilterChips/>,
            baseState({...defaultMentionFilters, channelIds: ['channel1']}, null),
        );

        expect(screen.getByText('Release Coordination (Product)')).toBeInTheDocument();

        await userEvent.click(screen.getByLabelText('Remove Release Coordination (Product) filter'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'MOCK_UPDATE_MENTION_FILTERS',
            filters: defaultMentionFilters,
            teamId: null,
        });
    });

    test('removing a chip re-runs the search without that one filter', async () => {
        renderWithContext(
            <MentionFilterChips/>,
            baseState({channelIds: ['channel1'], mentionTypes: ['direct'], date: 'today'}, 'team1'),
        );

        await userEvent.click(screen.getByLabelText('Remove Today filter'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'MOCK_UPDATE_MENTION_FILTERS',
            filters: {channelIds: ['channel1'], mentionTypes: ['direct'], date: 'any'},
            teamId: 'team1',
        });
    });

    test('removing the team chip widens the search back out to every team', async () => {
        renderWithContext(<MentionFilterChips/>, baseState(defaultMentionFilters, 'team1'));

        await userEvent.click(screen.getByLabelText('Remove Product filter'));

        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'MOCK_UPDATE_MENTION_FILTERS',
            filters: defaultMentionFilters,
            teamId: null,
        });
    });

    test('removing the team chip drops the channels picked on that team with it', async () => {
        renderWithContext(
            <MentionFilterChips/>,
            baseState({channelIds: ['channel1'], mentionTypes: ['direct'], date: 'any'}, 'team1'),
        );

        await userEvent.click(screen.getByLabelText('Remove Product filter'));

        // The other filters are left alone: only the channels belong to the team being left.
        expect(mockDispatch).toHaveBeenCalledWith({
            type: 'MOCK_UPDATE_MENTION_FILTERS',
            filters: {channelIds: [], mentionTypes: ['direct'], date: 'any'},
            teamId: null,
        });
    });
});
