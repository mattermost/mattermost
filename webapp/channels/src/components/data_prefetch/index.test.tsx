// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import {loadProfilesForSidebar} from 'actions/user_actions';

import {renderWithContext, runPostRenderAct} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import DataPrefetch from './index';

const mockQueue: Array<() => Promise<void>> = [];

jest.mock('p-queue', () => class PQueueMock {
    add = (o: () => Promise<void>) => mockQueue.push(o);
    clear = () => mockQueue.splice(0, mockQueue.length);
});

jest.mock('actions/user_actions', () => ({
    loadProfilesForSidebar: jest.fn(() => Promise.resolve({})),
}));

// The sidebar's DM and GM profiles are loaded from three requests that resolve in any order, and
// loadProfilesForSidebar silently loads nothing if it runs before all three have landed. These
// cover both of the orderings that leave it short.
describe('components/data_prefetch (connected)', () => {
    const currentUser = TestHelper.getUserMock({id: 'current_user_id'});
    const currentTeam = TestHelper.getTeamMock({id: 'current_team_id'});
    const channel = TestHelper.getChannelMock({id: 'channel_id', team_id: currentTeam.id});
    const category = TestHelper.getCategoryMock({
        id: 'category_id',
        team_id: currentTeam.id,
        user_id: currentUser.id,
        type: CategoryTypes.FAVORITES,
        channel_ids: [channel.id],
    });

    const nothingLoaded: DeepPartial<GlobalState> = {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {[currentUser.id]: currentUser},
            },
            teams: {
                currentTeamId: currentTeam.id,
                teams: {[currentTeam.id]: currentTeam},
            },
            channels: {
                channels: {[channel.id]: channel},
            },
        },
    };

    const categoriesLoaded: DeepPartial<GlobalState> = {
        entities: {
            channelCategories: {
                byId: {[category.id]: category},
                orderByTeam: {[currentTeam.id]: [category.id]},
            },
        },
    };

    const initChannelsLoaded: DeepPartial<GlobalState> = {
        entities: {
            channels: {
                channelsInTeam: {[currentTeam.id]: new Set([channel.id])},
            },
        },
        views: {
            channelSidebar: {
                initChannelsLoaded: true,
            },
        },
    };

    const initChannelMembershipsLoaded: DeepPartial<GlobalState> = {
        entities: {
            channels: {
                myMembers: {
                    [channel.id]: TestHelper.getChannelMembershipMock({
                        channel_id: channel.id,
                        user_id: currentUser.id,
                    }),
                },
            },
        },
        views: {
            channelSidebar: {
                initChannelMembershipsLoaded: true,
            },
        },
    };

    beforeEach(() => {
        mockQueue.splice(0, mockQueue.length);
        jest.clearAllMocks();
    });

    // One case per request arriving last, so that dropping any one of the three checks fails a test
    // rather than leaving a silently blank sidebar row.
    test.each([
        ['categories', [initChannelsLoaded, initChannelMembershipsLoaded, categoriesLoaded]],
        ['channels', [categoriesLoaded, initChannelMembershipsLoaded, initChannelsLoaded]],
        ['memberships', [categoriesLoaded, initChannelsLoaded, initChannelMembershipsLoaded]],
    ] as Array<[string, Array<DeepPartial<GlobalState>>]>)(
        'should not load profiles for the sidebar until the %s arrive last',
        async (_, [first, second, last]) => {
            const {updateStoreState} = renderWithContext(<DataPrefetch/>, nothingLoaded);

            updateStoreState(first);
            await runPostRenderAct();

            expect(loadProfilesForSidebar).not.toHaveBeenCalled();

            updateStoreState(second);
            await runPostRenderAct();

            expect(loadProfilesForSidebar).not.toHaveBeenCalled();

            updateStoreState(last);
            await runPostRenderAct();

            expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
        },
    );

    test('should only load profiles for the sidebar once', async () => {
        const {updateStoreState} = renderWithContext(<DataPrefetch/>, nothingLoaded);

        updateStoreState(categoriesLoaded);
        updateStoreState(initChannelsLoaded);
        updateStoreState(initChannelMembershipsLoaded);
        await runPostRenderAct();

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);

        updateStoreState({});
        await runPostRenderAct();

        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
    });
});
