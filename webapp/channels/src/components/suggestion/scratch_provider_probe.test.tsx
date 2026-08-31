// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Temporary probe: not intended to be committed.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {waitFor} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

import SwitchChannelProvider, {quickSwitchSorter} from './switch_channel_provider';

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

const ORDER = ['dm_sam', 'gm_sam', 'sam_project'];

describe('DM over GM guarantee with a public channel in the same relevance tier', () => {
    it.each([
        ['dm_sam', 'gm_sam', 'sam_project'],
        ['dm_sam', 'sam_project', 'gm_sam'],
        ['gm_sam', 'dm_sam', 'sam_project'],
        ['gm_sam', 'sam_project', 'dm_sam'],
        ['sam_project', 'dm_sam', 'gm_sam'],
        ['sam_project', 'gm_sam', 'dm_sam'],
    ])('channel list order %s, %s, %s', async (...order) => {
        jest.mocked(Client4.autocompleteUsers).mockResolvedValue({users: [sam]});

        const state = makeState(ORDER);
        const switchProvider = new SwitchChannelProvider();
        switchProvider.store = mockStore(state);

        // Set the module level prefix the way the real quick switcher does
        switchProvider.handlePretextChanged('sam', jest.fn());
        await waitFor(() => expect(Client4.autocompleteUsers).toHaveBeenCalled());

        const channelList = (order as string[]).map((id) => state.entities.channels.channels[id]);
        const results = switchProvider.formatGroup('sam', channelList, [sam]);

        // eslint-disable-next-line no-console
        console.log(`input [${(order as string[]).join(', ')}] -> results [${results.terms.join(', ')}]`);

        if ((order as string[])[0] !== 'dm_sam') {
            return;
        }

        // Take the real wrapped items the provider produced and probe the comparator on them
        const byId: Record<string, any> = {};
        results.items.forEach((item: any) => {
            byId[item.channel.id] = item;
        });
        const dm = byId.dm_sam;
        const gm = byId.gm_sam;
        const open = byId.sam_project;

        // eslint-disable-next-line no-console
        console.log(`PAIR dm/gm=${quickSwitchSorter(dm, gm)} gm/open=${quickSwitchSorter(gm, open)} dm/open=${quickSwitchSorter(dm, open)}`);

        // eslint-disable-next-line no-console
        console.log(`FLAGS dm=${JSON.stringify({t: dm.channel.type, lva: dm.last_viewed_at, h: dm.hiddenInSidebar, d: dm.channel.display_name})} gm=${JSON.stringify({t: gm.channel.type, lva: gm.last_viewed_at, h: gm.hiddenInSidebar, d: gm.channel.display_name})} open=${JSON.stringify({t: open.channel.type, lva: open.last_viewed_at, h: open.hiddenInSidebar, d: open.channel.display_name})}`);

        for (const perm of [[dm, gm, open], [dm, open, gm], [gm, dm, open], [gm, open, dm], [open, dm, gm], [open, gm, dm]]) {
            const before = perm.map((w: any) => w.channel.id).join(', ');
            const after = [...perm].sort(quickSwitchSorter).map((w: any) => w.channel.id).join(', ');

            // eslint-disable-next-line no-console
            console.log(`  PERM [${before}] -> [${after}]`);
        }
    });
});
