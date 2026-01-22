// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Recap, ScheduledRecap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';
import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';

export function getAllRecaps(state: GlobalState): Recap[] {
    const {byId, allIds} = state.entities.recaps;
    return allIds.map((id) => byId[id]);
}

export function getRecap(state: GlobalState, recapId: string): Recap | undefined {
    return state.entities.recaps.byId[recapId] || undefined;
}

export const getRecapsByStatus = createSelector(
    'getRecapsByStatus',
    getAllRecaps,
    (_state: GlobalState, status: RecapStatus) => status,
    (recaps, status) => {
        return recaps.filter((recap) => recap.status === status);
    },
);

export const getSortedRecaps = createSelector(
    'getSortedRecaps',
    getAllRecaps,
    (recaps) => {
        return [...recaps].sort((a, b) => b.create_at - a.create_at);
    },
);

export const getCompletedRecaps = createSelector(
    'getCompletedRecaps',
    getAllRecaps,
    (recaps) => {
        return recaps.filter((recap) => recap.status === RecapStatus.COMPLETED).sort((a, b) => b.create_at - a.create_at);
    },
);

export const getPendingRecaps = createSelector(
    'getPendingRecaps',
    getAllRecaps,
    (recaps) => {
        return recaps.filter((recap) => recap.status === RecapStatus.PENDING || recap.status === RecapStatus.PROCESSING);
    },
);

export const getUnreadRecaps = createSelector(
    'getUnreadRecaps',
    getAllRecaps,
    (recaps) => {
        return recaps.filter((recap) => recap.read_at === 0).sort((a, b) => b.create_at - a.create_at);
    },
);

export const getReadRecaps = createSelector(
    'getReadRecaps',
    getAllRecaps,
    (recaps) => {
        return recaps.filter((recap) => recap.read_at > 0).sort((a, b) => b.read_at - a.read_at);
    },
);

// Scheduled Recap Selectors

export function getScheduledRecapsState(state: GlobalState): Record<string, ScheduledRecap> {
    return state.entities.recaps.scheduledRecaps || {};
}

export const getAllScheduledRecaps = createSelector(
    'getAllScheduledRecaps',
    getScheduledRecapsState,
    (scheduledRecaps) => Object.values(scheduledRecaps).sort((a, b) => b.create_at - a.create_at),
);

export const getActiveScheduledRecaps = createSelector(
    'getActiveScheduledRecaps',
    getAllScheduledRecaps,
    (scheduledRecaps) => scheduledRecaps.filter((sr) => sr.enabled && sr.delete_at === 0),
);

export const getPausedScheduledRecaps = createSelector(
    'getPausedScheduledRecaps',
    getAllScheduledRecaps,
    (scheduledRecaps) => scheduledRecaps.filter((sr) => !sr.enabled && sr.delete_at === 0),
);

export function getScheduledRecapById(state: GlobalState, id: string): ScheduledRecap | undefined {
    return getScheduledRecapsState(state)[id];
}

