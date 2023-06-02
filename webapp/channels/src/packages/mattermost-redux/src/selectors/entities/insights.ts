// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'mattermost-redux/selectors/create_selector';

import {GlobalState} from '@mattermost/types/store';
import {TimeFrame, TimeFrames, TopReaction} from '@mattermost/types/insights';

import {getCurrentTeamId} from './teams';

function sortTopReactions(reactions: TopReaction[] = []): TopReaction[] {
    return reactions.sort((a, b) => {
        return b.count - a.count;
    });
}

export function getTeamReactions(state: GlobalState) {
    return state.entities.insights.topReactions;
}

export const getReactionTimeFramesForCurrentTeam: (state: GlobalState) => Record<TimeFrame, Record<string, TopReaction>> = createSelector(
    'getReactionTimeFramesForCurrentTeam',
    getCurrentTeamId,
    getTeamReactions,
    (currentTeamId, reactions) => {
        return reactions[currentTeamId];
    },
);

export const getTopReactionsForCurrentTeam: (state: GlobalState, timeFrame: TimeFrame, maxResults?: number) => TopReaction[] = createSelector(
    'getTopReactionsForCurrentTeam',
    getReactionTimeFramesForCurrentTeam,
    (state: GlobalState, timeFrame: TimeFrames) => timeFrame,
    (state: GlobalState, timeFrame: TimeFrames, maxResults = 5) => maxResults,
    (reactions, timeFrame, maxResults) => {
        if (reactions && reactions[timeFrame]) {
            const reactionArr = Object.values(reactions[timeFrame]);
            sortTopReactions(reactionArr);

            return reactionArr.slice(0, maxResults);
        }
        return [];
    },
);

export function getMyTopReactions(state: GlobalState) {
    return state.entities.insights.myTopReactions;
}

export const getMyReactionTimeFramesForCurrentTeam: (state: GlobalState) => Record<TimeFrame, Record<string, TopReaction>> = createSelector(
    'getMyReactionTimeFramesForCurrentTeam',
    getCurrentTeamId,
    getMyTopReactions,
    (currentTeamId, reactions) => {
        return reactions[currentTeamId];
    },
);

export const getMyTopReactionsForCurrentTeam: (state: GlobalState, timeFrame: TimeFrame, maxResults?: number) => TopReaction[] = createSelector(
    'getMyTopReactionsForCurrentTeam',
    getMyReactionTimeFramesForCurrentTeam,
    (state: GlobalState, timeFrame: TimeFrames) => timeFrame,
    (state: GlobalState, timeFrame: TimeFrames, maxResults = 5) => maxResults,
    (reactions, timeFrame, maxResults) => {
        if (reactions && reactions[timeFrame]) {
            const reactionArr = Object.values(reactions[timeFrame]);
            sortTopReactions(reactionArr);

            return reactionArr.slice(0, maxResults);
        }
        return [];
    },
);
