// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {defaultMentionFilters} from 'utils/mention_search';

import MentionFiltersButton from './index';

// Only the search requests are stubbed out. The action, the reducer and the selectors are the real
// ones, so what the popover applies has to survive the whole round trip to show up on the button.
jest.mock('mattermost-redux/actions/search', () => ({
    ...jest.requireActual('mattermost-redux/actions/search'),
    searchPostsWithParams: jest.fn(() => () => Promise.resolve({data: {order: [], posts: {}}})),
    searchFilesWithParams: jest.fn(() => () => Promise.resolve({data: {}})),
}));

const state = {
    entities: {
        general: {config: {}, license: {}},
        users: {
            currentUserId: 'user1',
            profiles: {user1: {id: 'user1', username: 'alice', notify_props: {}, roles: ''}},
            statuses: {},
            profilesInChannel: {},
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', display_name: 'Product', delete_at: 0},
                team2: {id: 'team2', display_name: 'Platform', delete_at: 0},
            },
            myMembers: {team1: {team_id: 'team1'}, team2: {team_id: 'team2'}},
        },
        channels: {
            channels: {
                channel1: {id: 'channel1', team_id: 'team1', display_name: 'Release Coordination', name: 'release-coordination', type: 'O' as const, delete_at: 0},
            },
            channelsInTeam: {team1: new Set(['channel1'])},
            myMembers: {channel1: {channel_id: 'channel1', user_id: 'user1'}},
        },
        preferences: {myPreferences: {}},
    },
    views: {
        rhs: {
            mentionFilters: defaultMentionFilters,
            searchTeam: null,
        },
    },
};

// The team selector only appears when the server allows searching across teams.
const crossTeamState = {
    ...state,
    entities: {
        ...state.entities,
        general: {...state.entities.general, config: {EnableCrossTeamSearch: 'true' as const}},
    },
};

async function openPopover() {
    await userEvent.click(screen.getByTestId('mentionFiltersButton'));
    await screen.findByText('Mention type');
}

async function openCombobox(label: string) {
    await userEvent.click(screen.getByRole('combobox', {name: label}));
}

async function chooseOption(name: string | RegExp) {
    await userEvent.click(await screen.findByRole('option', {name}));
}

describe('MentionFiltersButton', () => {
    test('counts nothing before a filter is applied', () => {
        renderWithContext(<MentionFiltersButton/>, state);

        expect(screen.getByTestId('mentionFiltersButton')).toHaveTextContent('Filters');
        expect(screen.getByTestId('mentionFiltersButton')).not.toHaveTextContent('Filters (');
    });

    test('Apply applies the draft to the store', async () => {
        renderWithContext(<MentionFiltersButton/>, state);

        await openPopover();
        await userEvent.click(screen.getByLabelText('Directly mentioning you'));

        // * Verify nothing is applied while the popover is still open
        expect(screen.getByTestId('mentionFiltersButton')).not.toHaveTextContent('Filters (');

        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        // * Verify the popover closed and the count came back through the store
        await waitFor(() => expect(screen.queryByText('Mention type')).not.toBeInTheDocument());
        expect(screen.getByTestId('mentionFiltersButton')).toHaveTextContent('Filters (1)');
    });

    test('Escape discards the draft', async () => {
        renderWithContext(<MentionFiltersButton/>, state);

        await openPopover();
        await userEvent.click(screen.getByLabelText('Directly mentioning you'));
        await userEvent.keyboard('{Escape}');

        // * Verify the popover closed without applying anything
        await waitFor(() => expect(screen.queryByText('Mention type')).not.toBeInTheDocument());
        expect(screen.getByTestId('mentionFiltersButton')).not.toHaveTextContent('Filters (');

        // * Verify the discarded selection is not still sitting in the popover on reopen
        await openPopover();
        expect(screen.getByLabelText('Directly mentioning you')).not.toBeChecked();
    });

    test('opening from the keyboard moves focus onto the popover', async () => {
        renderWithContext(<MentionFiltersButton/>, crossTeamState);

        screen.getByTestId('mentionFiltersButton').focus();
        await userEvent.keyboard('{Enter}');

        // * Verify focus is on the dialog, and no Combobox menu opened from it
        const dialog = await screen.findByRole('dialog', {name: 'Filters'});
        await waitFor(() => expect(dialog).toHaveFocus());
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        // * Verify closing returns focus to the button
        await waitFor(() => expect(screen.getByTestId('mentionFiltersButton')).toHaveFocus());
    });

    test('opening with the mouse leaves focus on the button', async () => {
        renderWithContext(<MentionFiltersButton/>, crossTeamState);

        await openPopover();

        // * Verify focus stayed on the button
        expect(screen.getByTestId('mentionFiltersButton')).toHaveFocus();
    });

    test('Escape closes an open combobox first and the popover on the next press', async () => {
        renderWithContext(<MentionFiltersButton/>, crossTeamState);

        await openPopover();
        await openCombobox('Team');
        expect(screen.getByRole('option', {name: /Product/})).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        // * Verify only the menu closed and the popover is still open
        await waitFor(() => expect(screen.queryByRole('option', {name: /Product/})).not.toBeInTheDocument());
        expect(screen.getByText('Mention type')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        // * Verify the second press closes the popover
        await waitFor(() => expect(screen.queryByText('Mention type')).not.toBeInTheDocument());
    });

    test('keeps channels picked after a team change when Apply is selected', async () => {
        // The apply used to compare the incoming team against the applied one, which made it clear
        // the channels on the Apply click, after the popover had already cleared the old team's.
        renderWithContext(<MentionFiltersButton/>, crossTeamState);

        await openPopover();
        await openCombobox('Team');
        await chooseOption('Product');
        await openCombobox('Channel or Direct Messages');
        await chooseOption(/Release Coordination/);
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        // * Verify both the team and the channel are counted, not the team alone
        await waitFor(() => expect(screen.queryByText('Mention type')).not.toBeInTheDocument());
        expect(screen.getByTestId('mentionFiltersButton')).toHaveTextContent('Filters (2)');
    });
});
