// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {defaultMentionFilters} from 'utils/mention_search';

import MentionFiltersPopover from './mention_filters_popover';

const state = {
    entities: {
        channels: {
            channels: {
                channel1: {id: 'channel1', team_id: 'team1', display_name: 'Release Coordination', name: 'release-coordination', type: 'O' as const, delete_at: 0},
                channel2: {id: 'channel2', team_id: 'team2', display_name: 'Mobile', name: 'mobile', type: 'O' as const, delete_at: 0},
            },
            channelsInTeam: {team1: new Set(['channel1']), team2: new Set(['channel2'])},
            myMembers: {
                channel1: {channel_id: 'channel1', user_id: 'user1'},
                channel2: {channel_id: 'channel2', user_id: 'user1'},
            },
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', display_name: 'Product', delete_at: 0},
                team2: {id: 'team2', display_name: 'Platform', delete_at: 0},
            },
            myMembers: {team1: {team_id: 'team1'}, team2: {team_id: 'team2'}},
        },
    },
};

function setup(props: Partial<React.ComponentProps<typeof MentionFiltersPopover>> = {}, general = {}) {
    const onApply = jest.fn();
    const onClose = jest.fn();

    renderWithContext(
        <MentionFiltersPopover
            filters={defaultMentionFilters}
            teamId={null}
            showTeamSelector={true}
            onApply={onApply}
            onClose={onClose}
            {...props}
        />,
        {...state, entities: {...state.entities, general}},
    );

    return {onApply, onClose};
}

async function openCombobox(label: string) {
    await userEvent.click(screen.getByRole('combobox', {name: label}));
}

async function chooseOption(name: string) {
    await userEvent.click(await screen.findByRole('option', {name}));
}

describe('MentionFiltersPopover', () => {
    test('applies nothing until Apply is selected', async () => {
        const {onApply} = setup();

        await userEvent.click(screen.getByLabelText('Directly mentioning you'));
        expect(onApply).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
        expect(onApply).toHaveBeenCalledWith({...defaultMentionFilters, mentionTypes: ['direct']}, null);
    });

    test('closes after applying', async () => {
        const {onClose} = setup();

        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        expect(onClose).toHaveBeenCalled();
    });

    test('lists channels from every team until a team is chosen', async () => {
        setup();

        await openCombobox('Channel or Direct Messages');

        expect(await screen.findByRole('option', {name: /Release Coordination/})).toBeInTheDocument();
        expect(screen.getByRole('option', {name: /Mobile/})).toBeInTheDocument();
    });

    test('narrows the channel list to the chosen team', async () => {
        setup({teamId: 'team1'});

        await openCombobox('Channel or Direct Messages');

        expect(await screen.findByRole('option', {name: /Release Coordination/})).toBeInTheDocument();
        expect(screen.queryByRole('option', {name: /Mobile/})).not.toBeInTheDocument();
    });

    test('drops the selected channels when the team changes, since they belong to the team being left', async () => {
        const {onApply} = setup({filters: {...defaultMentionFilters, channelIds: ['channel1']}, teamId: 'team1'});

        await openCombobox('Team');
        await chooseOption('Platform');
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        expect(onApply).toHaveBeenCalledWith(defaultMentionFilters, 'team2');
    });

    test('only one date range can be chosen at a time', async () => {
        const {onApply} = setup();

        await userEvent.click(screen.getByLabelText('Today'));
        await userEvent.click(screen.getByLabelText('Last 7 days'));
        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

        expect(onApply).toHaveBeenCalledWith({...defaultMentionFilters, date: 'last_7_days'}, null);
    });

    test('Reset clears the filters without applying them', async () => {
        const {onApply} = setup({filters: {channelIds: ['channel1'], mentionTypes: ['direct'], date: 'today'}, teamId: 'team1'});

        await userEvent.click(screen.getByRole('button', {name: 'Reset'}));
        expect(onApply).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
        expect(onApply).toHaveBeenCalledWith(defaultMentionFilters, null);
    });

    test('hides the team selector when cross team search is unavailable', () => {
        setup({showTeamSelector: false});

        expect(screen.queryByTestId('mentionFiltersTeamSelector')).not.toBeInTheDocument();
        expect(screen.getByRole('combobox', {name: 'Channel or Direct Messages'})).toBeInTheDocument();
    });

    test('hides the group mentions option without a license for groups', () => {
        setup();

        expect(screen.getByLabelText('Directly mentioning you')).toBeInTheDocument();
        expect(screen.queryByLabelText('Group mentions')).not.toBeInTheDocument();
    });

    test('shows the group mentions option when custom groups are enabled', () => {
        setup({}, {config: {EnableCustomGroups: 'true'}});

        expect(screen.getByLabelText('Group mentions')).toBeInTheDocument();
    });

    test('shows the group mentions option when licensed for LDAP groups', () => {
        setup({}, {license: {IsLicensed: 'true', LDAPGroups: 'true'}});

        expect(screen.getByLabelText('Group mentions')).toBeInTheDocument();
    });
});
