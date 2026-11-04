// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHookWithContext} from 'tests/react_testing_utils';

import useFilterableChannels, {useTeamNames} from './use_filterable_channels';

// A channel per case the hook has to separate: two teams, an archived channel, a channel the user
// has left, and the two channel kinds that belong to no team at all.
const state = {
    entities: {
        channels: {
            channels: {
                product: {id: 'product', team_id: 'team1', display_name: 'Product', name: 'product', type: 'O' as const, delete_at: 0},
                mobile: {id: 'mobile', team_id: 'team2', display_name: 'Mobile', name: 'mobile', type: 'O' as const, delete_at: 0},
                archived: {id: 'archived', team_id: 'team1', display_name: 'Archived', name: 'archived', type: 'O' as const, delete_at: 1234},
                notAMember: {id: 'notAMember', team_id: 'team1', display_name: 'Not A Member', name: 'not-a-member', type: 'O' as const, delete_at: 0},
                dm: {id: 'dm', team_id: '', display_name: '', name: 'user1__user2', type: 'D' as const, delete_at: 0},
                gm: {id: 'gm', team_id: '', display_name: 'user2, user3', name: 'gmchannelname', type: 'G' as const, delete_at: 0},
            },
            channelsInTeam: {
                team1: new Set(['product', 'archived', 'notAMember']),
                team2: new Set(['mobile']),
                '': new Set(['dm', 'gm']),
            },
            myMembers: {
                product: {channel_id: 'product', user_id: 'user1'},
                mobile: {channel_id: 'mobile', user_id: 'user1'},
                archived: {channel_id: 'archived', user_id: 'user1'},
                dm: {channel_id: 'dm', user_id: 'user1'},
                gm: {channel_id: 'gm', user_id: 'user1'},
            },
        },
        teams: {
            currentTeamId: 'team1',
            teams: {
                team1: {id: 'team1', display_name: 'Product Team', delete_at: 0},
                team2: {id: 'team2', display_name: 'Platform Team', delete_at: 0},
            },
            myMembers: {team1: {team_id: 'team1'}, team2: {team_id: 'team2'}},
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: {id: 'user1', username: 'user1'},
                user2: {id: 'user2', username: 'user2'},
                user3: {id: 'user3', username: 'user3'},
            },
            statuses: {},
            profilesInChannel: {gm: new Set(['user2', 'user3'])},
        },
    },
};

function idsFor(teamId: string | null) {
    const {result} = renderHookWithContext(() => useFilterableChannels(teamId), state);
    return result.current.map((channel) => channel.id).sort();
}

describe('useFilterableChannels', () => {
    test('lists the channels of every team when no team is selected', () => {
        expect(idsFor(null)).toEqual(['dm', 'gm', 'mobile', 'product']);
    });

    test('narrows to the selected team, keeping DMs and GMs that belong to no team', () => {
        expect(idsFor('team1')).toEqual(['dm', 'gm', 'product']);
        expect(idsFor('team2')).toEqual(['dm', 'gm', 'mobile']);
    });

    test('excludes archived channels', () => {
        // The user is still a member of the archived channel, so only delete_at keeps it out.
        expect(idsFor(null)).not.toContain('archived');
        expect(idsFor('team1')).not.toContain('archived');
    });

    test('excludes a channel the user is not a member of', () => {
        expect(idsFor('team1')).not.toContain('notAMember');
    });
});

describe('useTeamNames', () => {
    test('maps team id to display name', () => {
        const {result} = renderHookWithContext(() => useTeamNames(), state);

        expect(result.current).toEqual({team1: 'Product Team', team2: 'Platform Team'});
    });
});
