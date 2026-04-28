// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Recap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';
import type {GlobalState} from '@mattermost/types/store';

import {getUnreadFinishedRecapsBadge} from './recaps';

function makeRecap(id: string, status: RecapStatus, viewedAt: number): Recap {
    return {
        id,
        user_id: 'user1',
        title: `Recap ${id}`,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        read_at: 0,
        viewed_at: viewedAt,
        total_message_count: 0,
        status,
        bot_id: 'bot1',
    } as Recap;
}

function makeState(recaps: Recap[]): GlobalState {
    const byId: Record<string, Recap> = {};
    const allIds: string[] = [];
    for (const r of recaps) {
        byId[r.id] = r;
        allIds.push(r.id);
    }
    return {
        entities: {
            recaps: {byId, allIds},
        },
    } as unknown as GlobalState;
}

describe('selectors/entities/recaps', () => {
    describe('getUnreadFinishedRecapsBadge', () => {
        test('returns zero count when there are no recaps', () => {
            const state = makeState([]);
            expect(getUnreadFinishedRecapsBadge(state)).toEqual({count: 0, hasFailed: false});
        });

        test('counts not-yet-viewed completed recaps', () => {
            const state = makeState([
                makeRecap('a', RecapStatus.COMPLETED, 0),
                makeRecap('b', RecapStatus.COMPLETED, 0),
                makeRecap('c', RecapStatus.COMPLETED, 123),
            ]);
            expect(getUnreadFinishedRecapsBadge(state)).toEqual({count: 2, hasFailed: false});
        });

        test('excludes pending and processing recaps from the count', () => {
            const state = makeState([
                makeRecap('a', RecapStatus.PENDING, 0),
                makeRecap('b', RecapStatus.PROCESSING, 0),
                makeRecap('c', RecapStatus.COMPLETED, 0),
            ]);
            expect(getUnreadFinishedRecapsBadge(state)).toEqual({count: 1, hasFailed: false});
        });

        test('includes not-yet-viewed failed recaps and flags hasFailed', () => {
            const state = makeState([
                makeRecap('a', RecapStatus.COMPLETED, 0),
                makeRecap('b', RecapStatus.FAILED, 0),
            ]);
            expect(getUnreadFinishedRecapsBadge(state)).toEqual({count: 2, hasFailed: true});
        });

        test('does not set hasFailed when failed recap has been viewed', () => {
            const state = makeState([
                makeRecap('a', RecapStatus.COMPLETED, 0),
                makeRecap('b', RecapStatus.FAILED, 500),
            ]);
            expect(getUnreadFinishedRecapsBadge(state)).toEqual({count: 1, hasFailed: false});
        });
    });
});
