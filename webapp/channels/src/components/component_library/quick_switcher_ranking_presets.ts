// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {RankableWrappedChannel} from '../suggestion/quick_switch_ranking';

const DAY = 24 * 60 * 60 * 1000;

/** Frozen "now" so activity bands stay stable in the playground. */
export const PLAYGROUND_NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

function wrap(
    id: string,
    type: string,
    lastViewedAt: number | undefined,
    displayName: string,
    extras: Partial<RankableWrappedChannel> & {channelName?: string; deleteAt?: number} = {},
): RankableWrappedChannel {
    const {channelName, deleteAt, ...rest} = extras;
    return {
        channel: TestHelper.getChannelMock({
            id,
            name: channelName || displayName,
            display_name: displayName,
            type: type as Channel['type'],
            delete_at: deleteAt || 0,
        }),
        name: channelName || displayName,
        deactivated: false,
        last_viewed_at: lastViewedAt,
        ...rest,
    };
}

export type RankingScenarioPreset = {
    id: string;
    label: string;
    defaultSearch: string;
    description: string;
    now: number;
    channels: RankableWrappedChannel[];
};

export const SCENARIO_PRESETS: RankingScenarioPreset[] = [
    {
        id: 'mixed-kitchen-sink',
        label: 'Kitchen sink',
        defaultSearch: 'a',
        description: 'Compact set that exercises every penalty column.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('alice-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'alice', {name: 'alice'}),
            wrap('never-adam', Constants.DM_CHANNEL, undefined, 'adam', {name: 'adam'}),
            wrap('gm-alice', Constants.GM_CHANNEL, PLAYGROUND_NOW - DAY, 'alice, bob'),
            wrap('mid-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW, 'bob, carol', {hiddenInSidebar: true}),
            wrap('announcements', Constants.OPEN_CHANNEL, PLAYGROUND_NOW - (40 * DAY), 'Announcements', {
                channelName: 'announcements',
            }),
            wrap('archived-alpha', Constants.OPEN_CHANNEL, PLAYGROUND_NOW, 'Alpha', {
                channelName: 'alpha',
                deleteAt: 1,
            }),
            wrap('deactivated-amy', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'amy', {
                name: 'amy',
                deactivated: true,
            }),
        ],
    },
    {
        id: 'sysadmin-dm-vs-gm',
        label: 'sysadmin DM vs GM ("sys")',
        defaultSearch: 'sys',
        description: 'Never-opened sysadmin DM vs recently viewed "sysadmin, user-1" GM — both are prefix matches; DM should lead.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('sysadmin-dm', Constants.DM_CHANNEL, undefined, 'sysadmin', {name: 'sysadmin'}),
            wrap('sysadmin-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW - (2 * 60 * 60 * 1000), 'sysadmin, user-1'),
            wrap('system-channel', Constants.OPEN_CHANNEL, PLAYGROUND_NOW - (5 * DAY), 'system-updates'),
        ],
    },
    {
        id: 'off-topic-vs-hinton',
        label: 'Off-Topic vs geoffrey.hinton ("off")',
        defaultSearch: 'off',
        description: 'Prefix channel should beat a mid-string DM match.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('midstring-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'geoffrey.hinton', {name: 'geoffrey.hinton'}),
            wrap('off-topic', Constants.OPEN_CHANNEL, PLAYGROUND_NOW, 'Off-Topic', {channelName: 'off-topic'}),
        ],
    },
    {
        id: 'sam-prefix-vs-midstring',
        label: 'Prefix DM vs mid-string GM/channel ("sam")',
        defaultSearch: 'sam',
        description: 'Stale prefix DM should still beat recent mid-string matches.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('stale-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW - (90 * DAY), 'sam.stale', {name: 'sam.stale'}),
            wrap('recent-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW, 'wanda.pryor, sam.smith'),
            wrap('recent-channel', Constants.OPEN_CHANNEL, PLAYGROUND_NOW, 'project-sam', {channelName: 'project-sam'}),
        ],
    },
    {
        id: 'sam-same-recency-types',
        label: 'Same recency: DM > GM > channel ("sam")',
        defaultSearch: 'sam',
        description: 'Within a band, conversation type separates equally recent results.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('recent-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW, 'sam.smith, wanda.pryor'),
            wrap('recent-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'sam.smith', {name: 'sam.smith'}),
            wrap('recent-channel', Constants.OPEN_CHANNEL, PLAYGROUND_NOW, 'project-sam', {channelName: 'project-sam'}),
        ],
    },
    {
        id: 'hidden-gm',
        label: 'Hidden GM vs visible GM',
        defaultSearch: 'delp',
        description: 'A GM hidden from the sidebar trails an equally relevant visible one.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('visible-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW - DAY, 'delphine, esme.fielder'),
            wrap('hidden-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW, 'delphine, wanda.pryor', {hiddenInSidebar: true}),
            wrap('delphine-dm', Constants.DM_CHANNEL, undefined, 'delphine', {name: 'delphine'}),
        ],
    },
    {
        id: 'archived-and-deactivated',
        label: 'Archived channel & deactivated DM',
        defaultSearch: 'arch',
        description: 'Archived and deactivated rows sink below active matches.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('active-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'archie', {name: 'archie'}),
            wrap('deactivated-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW, 'archie.old', {
                name: 'archie.old',
                deactivated: true,
            }),
            wrap('archived-channel', Constants.OPEN_CHANNEL, PLAYGROUND_NOW, 'Architecture', {
                channelName: 'architecture',
                deleteAt: PLAYGROUND_NOW - DAY,
            }),
        ],
    },
    {
        id: 'activity-bands',
        label: 'Activity bands (recent / stale / never)',
        defaultSearch: 'team',
        description: 'Same type and prefix quality; only last_viewed_at differs.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('never-dm', Constants.DM_CHANNEL, undefined, 'team.lead', {name: 'team.lead'}),
            wrap('stale-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW - (90 * DAY), 'team.mate', {name: 'team.mate'}),
            wrap('recent-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW - (2 * 60 * 60 * 1000), 'team.captain', {name: 'team.captain'}),
        ],
    },
    {
        id: 'threads-vs-dm',
        label: 'Threads vs DM',
        defaultSearch: 'thr',
        description: 'Threads share the DM type tier (penalty 0).',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('threads', Constants.THREADS, PLAYGROUND_NOW, 'Threads', {channelName: 'threads'}),
            wrap('three-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW - DAY, 'three.user', {name: 'three.user'}),
            wrap('thread-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW - (3 * DAY), 'thread_gm_channel', {
                hiddenInSidebar: true,
            }),
        ],
    },
    {
        id: 'calls-display',
        label: 'Calls GM display name ("cal")',
        defaultSearch: 'cal',
        description: 'Ranking uses the visible display name / member fields — not the opaque channel hash.',
        now: PLAYGROUND_NOW,
        channels: [
            wrap('calls-dm', Constants.DM_CHANNEL, PLAYGROUND_NOW - (10 * 60 * 1000), 'calls', {name: 'calls'}),
            wrap('calls-gm', Constants.GM_CHANNEL, PLAYGROUND_NOW, 'calls, user-1', {
                channelName: '28e2c55b230cfac24733c17b6996b65789b283bc',
            }),
        ],
    },
];
