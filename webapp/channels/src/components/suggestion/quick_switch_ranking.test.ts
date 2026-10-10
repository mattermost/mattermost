// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {RankableWrappedChannel, RankPenaltyWeights} from './quick_switch_ranking';
import {
    DEFAULT_RANK_PENALTY_WEIGHTS,
    makeQuickSwitchSorter,
    rankingDebugRows,
    validatePenaltyDominance,
} from './quick_switch_ranking';

describe('quick_switch_ranking', () => {
    const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);
    const DAY = 24 * 60 * 60 * 1000;

    function wrap(id: string, type: string, lastViewedAt: number, name: string, extras: Partial<RankableWrappedChannel> = {}): RankableWrappedChannel {
        return {
            channel: TestHelper.getChannelMock({
                id,
                name,
                display_name: name,
                type: type as Channel['type'],
                delete_at: 0,
            }),
            name,
            deactivated: false,
            last_viewed_at: lastViewedAt,
            ...extras,
        };
    }

    function permutations<T>(items: T[]): T[][] {
        if (items.length <= 1) {
            return [items];
        }

        return items.flatMap((item, i) => (
            permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
        ));
    }

    describe('makeQuickSwitchSorter', () => {
        it('orders a result set the same way no matter which order it is merged in', () => {
            const results = [
                wrap('dm', Constants.DM_CHANNEL, 1, 'sam.smith'),
                wrap('gm', Constants.GM_CHANNEL, 1000, 'sam.smith, wanda.pryor'),
                wrap('open', Constants.OPEN_CHANNEL, 500, 'project-sam'),
            ];

            const orderings = permutations(results).map((ordering) => (
                [...ordering].sort(makeQuickSwitchSorter('sam', DEFAULT_RANK_PENALTY_WEIGHTS, NOW)).
                    map((result) => result.channel.id).join(',')
            ));

            // All three were last read long ago, so they share a recency band. The direct message is
            // a prefix match on the term while the group message and channel only contain it, so the
            // direct message leads and the remaining two sort by type: group message, then channel
            expect(new Set(orderings)).toEqual(new Set(['dm,gm,open']));
        });

        it('ranks recently used conversations above stale ones regardless of type', () => {
            const recent = NOW;
            const stale = NOW - (90 * DAY);

            const results = [
                wrap('stale-dm', Constants.DM_CHANNEL, stale, 'sam.stale'),
                wrap('recent-gm', Constants.GM_CHANNEL, recent, 'sam.smith, wanda.pryor'),
                wrap('recent-channel', Constants.OPEN_CHANNEL, recent, 'project-sam'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam', DEFAULT_RANK_PENALTY_WEIGHTS, NOW)).
                map((result) => result.channel.id)).
                toEqual(['recent-gm', 'recent-channel', 'stale-dm']);
        });

        it('ranks a direct message above a group message and channel within the same recency band', () => {
            const recent = NOW;

            const results = [
                wrap('recent-gm', Constants.GM_CHANNEL, recent, 'sam.smith, wanda.pryor'),
                wrap('recent-dm', Constants.DM_CHANNEL, recent, 'sam.smith'),
                wrap('recent-channel', Constants.OPEN_CHANNEL, recent, 'project-sam'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam', DEFAULT_RANK_PENALTY_WEIGHTS, NOW)).
                map((result) => result.channel.id)).
                toEqual(['recent-dm', 'recent-gm', 'recent-channel']);
        });

        it('ranks a channel the term is a prefix of above a direct message that only contains it', () => {
            const recent = NOW;

            const results = [
                wrap('midstring-dm', Constants.DM_CHANNEL, recent, 'geoffrey.hinton'),
                wrap('prefix-channel', Constants.OPEN_CHANNEL, recent, 'off-topic'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('off', DEFAULT_RANK_PENALTY_WEIGHTS, NOW)).
                map((result) => result.channel.id)).
                toEqual(['prefix-channel', 'midstring-dm']);
        });

        it('sorts a never-opened direct message below any conversation with activity', () => {
            const stale = NOW - (90 * DAY);

            const results = [
                wrap('never-dm', Constants.DM_CHANNEL, 0, 'sam.newperson'),
                wrap('stale-gm', Constants.GM_CHANNEL, stale, 'sam.smith, wanda.pryor'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sam', DEFAULT_RANK_PENALTY_WEIGHTS, NOW)).
                map((result) => result.channel.id)).
                toEqual(['stale-gm', 'never-dm']);
        });

        it('respects injectable weights so type-first ranking can prefer a never-opened DM', () => {
            const typeFirst: RankPenaltyWeights = {
                ...DEFAULT_RANK_PENALTY_WEIGHTS,
                archived: 96,
                deactivated: 48,
                nonPrefixMatch: 24,
                groupMessage: 8,
                channel: 12,
                staleActivity: 2,
                noActivity: 4,
            };

            const results = [
                wrap('never-dm', Constants.DM_CHANNEL, 0, 'sysadmin'),
                wrap('recent-gm', Constants.GM_CHANNEL, NOW, 'sysadmin, user-1'),
            ];

            expect([...results].sort(makeQuickSwitchSorter('sys', typeFirst, NOW)).
                map((result) => result.channel.id)).
                toEqual(['never-dm', 'recent-gm']);
        });
    });

    describe('rankingDebugRows', () => {
        it('returns ordered rows with a penalty breakdown', () => {
            const rows = rankingDebugRows(
                'sam',
                [
                    wrap('never-dm', Constants.DM_CHANNEL, 0, 'sam.newperson'),
                    wrap('stale-gm', Constants.GM_CHANNEL, NOW - (90 * DAY), 'sam.smith, wanda.pryor'),
                ],
                DEFAULT_RANK_PENALTY_WEIGHTS,
                NOW,
            );

            expect(rows.map((row) => row.id)).toEqual(['stale-gm', 'never-dm']);
            expect(rows[0]).toMatchObject({
                id: 'stale-gm',
                isPrefixMatch: false,
                conversationType: DEFAULT_RANK_PENALTY_WEIGHTS.groupMessage,
                activity: DEFAULT_RANK_PENALTY_WEIGHTS.staleActivity,
            });
            expect(rows[1]).toMatchObject({
                id: 'never-dm',
                isPrefixMatch: true,
                conversationType: 0,
                activity: DEFAULT_RANK_PENALTY_WEIGHTS.noActivity,
            });
            expect(rows[0].rank).toBeLessThan(rows[1].rank);
        });
    });

    describe('validatePenaltyDominance', () => {
        it('returns no warnings for production defaults', () => {
            expect(validatePenaltyDominance(DEFAULT_RANK_PENALTY_WEIGHTS)).toEqual([]);
        });

        it('warns when noActivity cannot beat stale plus weaker tiers', () => {
            const warnings = validatePenaltyDominance({
                ...DEFAULT_RANK_PENALTY_WEIGHTS,
                noActivity: 10,
                staleActivity: 12,
            });

            expect(warnings.some((warning) => warning.includes('noActivity'))).toBe(true);
        });
    });
});
