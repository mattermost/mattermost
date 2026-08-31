// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Temporary probe: not intended to be committed.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {waitFor} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import SwitchChannelProvider from './switch_channel_provider';

jest.mock('mattermost-redux/client', () => {
    const original = jest.requireActual('mattermost-redux/client');

    return {
        ...original,
        Client4: {
            ...original.Client4,
            autocompleteUsers: jest.fn().mockResolvedValue({users: []}),
        },
    };
});

jest.mock('mattermost-redux/actions/channels', () => ({
    ...jest.requireActual('mattermost-redux/actions/channels'),
    searchAllChannels: () => jest.fn().mockResolvedValue(Promise.resolve({data: []})),
}));

const sam = TestHelper.getUserMock({id: 'sam_id', username: 'sam.smith', first_name: 'Sam', last_name: 'Smith'});
const zoe = TestHelper.getUserMock({id: 'zoe_id', username: 'zoe.zimmerman'});

function makeState(channelOrder: string[]) {
    const built: Record<string, Channel> = {
        // An old DM with the person being searched for
        dm_sam: TestHelper.getChannelMock({
            id: 'dm_sam',
            type: 'D',
            name: 'current_user_id__sam_id',
            display_name: '',
            delete_at: 0,
            team_id: '',
        }),

        // A group message containing that person, read much more recently
        gm_sam: TestHelper.getChannelMock({
            id: 'gm_sam',
            type: 'G',
            name: 'gm_sam',
            display_name: '',
            delete_at: 0,
            team_id: '',
        }),

        // A public channel whose name also starts with the search term, read in between
        sam_project: TestHelper.getChannelMock({
            id: 'sam_project',
            type: 'O',
            name: 'sam-project',
            display_name: 'Sam Project',
            delete_at: 0,
            team_id: 'currentTeamId',
        }),
    };

    const channels: Record<string, Channel> = {};
    channelOrder.forEach((id) => {
        channels[id] = built[id];
    });

    const profiles: Record<string, UserProfile> = {
        current_user_id: TestHelper.getUserMock({id: 'current_user_id', username: 'current.user'}),
        sam_id: sam,
        zoe_id: zoe,
    };

    return {
        entities: {
            general: {config: {}},
            channels: {
                channels,
                myMembers: {
                    dm_sam: {channel_id: 'dm_sam', last_viewed_at: 1},
                    gm_sam: {channel_id: 'gm_sam', last_viewed_at: 1000},
                    sam_project: {channel_id: 'sam_project', last_viewed_at: 500},
                },
                channelsInTeam: {'': new Set(['dm_sam', 'gm_sam']), currentTeamId: new Set(['sam_project'])},
                messageCounts: {},
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        user_id: 'current_user_id',
                        value: 'username',
                    },
                    'group_channel_show--gm_sam': {
                        category: 'group_channel_show',
                        name: 'gm_sam',
                        user_id: 'current_user_id',
                        value: 'true',
                    },
                },
            },
            users: {
                profiles,
                currentUserId: 'current_user_id',
                profilesInChannel: {
                    dm_sam: new Set(['current_user_id', 'sam_id']),
                    gm_sam: new Set(['current_user_id', 'sam_id', 'zoe_id']),
                },
            },
            teams: {
                currentTeamId: 'currentTeamId',
                teams: {
                    currentTeamId: TestHelper.getTeamMock({id: 'currentTeamId', display_name: 'test', type: 'O', delete_at: 0}),
                },
            },
            posts: {posts: {}, postsInChannel: {}, postsInThread: {}},
        },
        posts: {posts: {}, postsInChannel: {}, postsInThread: {}},
    };
}

describe('DM over GM guarantee with a public channel in the same relevance tier', () => {
    it.each([
        ['dm_sam', 'gm_sam', 'sam_project'],
        ['gm_sam', 'dm_sam', 'sam_project'],
        ['sam_project', 'gm_sam', 'dm_sam'],
        ['gm_sam', 'sam_project', 'dm_sam'],
    ])('store key order %s, %s, %s', async (...order) => {
        jest.mocked(Client4.autocompleteUsers).mockResolvedValue({users: [sam]});

        const switchProvider = new SwitchChannelProvider();
        switchProvider.store = mockStore(makeState(order as string[]));

        const resultsCallback = jest.fn();
        switchProvider.handlePretextChanged('sam', resultsCallback);

        await waitFor(() => expect(resultsCallback).toHaveBeenCalledTimes(2));

        const local = resultsCallback.mock.calls[0][0].groups[0];
        const merged = resultsCallback.mock.calls[1][0].groups[0];

        // eslint-disable-next-line no-console
        console.log(`state key order [${(order as string[]).join(', ')}] -> local [${local.terms.join(', ')}] -> merged [${merged.terms.join(', ')}]`);

        // eslint-disable-next-line no-console
        console.log('  last_viewed_at: ' + merged.items.map((i: any) => `${i.channel.id}:${i.channel.type}:${i.last_viewed_at}`).join(' '));
    });
});
