// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {sortChannelsByTypeAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import {Constants} from 'utils/constants';

export type RankPenaltyWeights = {
    archived: number;
    deactivated: number;
    nonPrefixMatch: number;
    groupMessage: number;
    channel: number;
    staleActivity: number;
    noActivity: number;
    hiddenInSidebar: number;
    recentActivityWindowMs: number;
};

export const DEFAULT_RANK_PENALTY_WEIGHTS: RankPenaltyWeights = {
    archived: 96,
    deactivated: 48,
    nonPrefixMatch: 24,
    groupMessage: 8,
    channel: 12,
    staleActivity: 2,
    noActivity: 4,
    hiddenInSidebar: 1,
    recentActivityWindowMs: 30 * 24 * 60 * 60 * 1000,
};

/** Minimal shape ranking needs (playground fixtures + production WrappedChannel). */
export type RankableWrappedChannel = {
    channel: {
        id: string;
        type: string;
        display_name: string;
        delete_at?: number;
        name?: string;
    };
    name: string;
    deactivated?: boolean;
    last_viewed_at?: number;
    hiddenInSidebar?: boolean;
};

export type RankPenaltyBreakdown = {
    archived: number;
    deactivated: number;
    nonPrefixMatch: number;
    conversationType: number;
    activity: number;
    hiddenInSidebar: number;
};

export type RankingDebugRow = RankPenaltyBreakdown & {
    id: string;
    name: string;
    channelType: string;
    rank: number;
    last_viewed_at: string;
    isPrefixMatch: boolean;
};

export function normalizeSearchTerm(searchTerm: string) {
    const lowerCased = searchTerm.toLowerCase();
    return lowerCased.startsWith('@') ? lowerCased.substring(1) : lowerCased;
}

export function startsWithSearchTerm(wrapped: RankableWrappedChannel, searchTerm: string) {
    const channel = wrapped.channel;

    let displayName = channel.display_name.toLowerCase();
    if (channel.type === Constants.DM_CHANNEL && displayName.startsWith('@')) {
        displayName = displayName.substring(1);
    }

    return displayName.startsWith(searchTerm) || wrapped.name.toLowerCase().startsWith(searchTerm);
}

function activityRankPenalty(
    wrapped: RankableWrappedChannel,
    weights: RankPenaltyWeights,
    now: number,
) {
    if (!wrapped.last_viewed_at) {
        return weights.noActivity;
    }

    if (now - wrapped.last_viewed_at > weights.recentActivityWindowMs) {
        return weights.staleActivity;
    }

    return 0;
}

function typeRankPenalty(channelType: string, weights: RankPenaltyWeights) {
    if (channelType === Constants.DM_CHANNEL || channelType === Constants.THREADS) {
        return 0;
    }

    if (channelType === Constants.GM_CHANNEL) {
        return weights.groupMessage;
    }

    return weights.channel;
}

export function rankPenalties(
    wrapped: RankableWrappedChannel,
    searchTerm: string,
    weights: RankPenaltyWeights = DEFAULT_RANK_PENALTY_WEIGHTS,
    now: number = Date.now(),
): RankPenaltyBreakdown {
    const channel = wrapped.channel;
    const normalizedTerm = normalizeSearchTerm(searchTerm);

    return {
        archived: channel.delete_at ? weights.archived : 0,
        deactivated: wrapped.deactivated ? weights.deactivated : 0,
        nonPrefixMatch: startsWithSearchTerm(wrapped, normalizedTerm) ? 0 : weights.nonPrefixMatch,
        conversationType: typeRankPenalty(channel.type, weights),
        activity: activityRankPenalty(wrapped, weights, now),
        hiddenInSidebar: wrapped.hiddenInSidebar ? weights.hiddenInSidebar : 0,
    };
}

export function searchRank(
    wrapped: RankableWrappedChannel,
    searchTerm: string,
    weights: RankPenaltyWeights = DEFAULT_RANK_PENALTY_WEIGHTS,
    now: number = Date.now(),
) {
    const penalties = rankPenalties(wrapped, searchTerm, weights, now);

    return penalties.archived +
        penalties.deactivated +
        penalties.nonPrefixMatch +
        penalties.conversationType +
        penalties.activity +
        penalties.hiddenInSidebar;
}

function sortChannelsByRecencyAndTypeAndDisplayName(
    wrappedA: RankableWrappedChannel,
    wrappedB: RankableWrappedChannel,
) {
    if (wrappedA.last_viewed_at && wrappedB.last_viewed_at) {
        return wrappedB.last_viewed_at - wrappedA.last_viewed_at;
    } else if (wrappedA.last_viewed_at) {
        return -1;
    } else if (wrappedB.last_viewed_at) {
        return 1;
    }

    // MM-12677 When this is migrated this needs to be fixed to pull the user's locale
    return sortChannelsByTypeAndDisplayName(
        'en',
        wrappedA.channel as Channel,
        wrappedB.channel as Channel,
    );
}

export function makeQuickSwitchSorter(
    searchTerm: string,
    weights: RankPenaltyWeights = DEFAULT_RANK_PENALTY_WEIGHTS,
    now: number = Date.now(),
) {
    const normalizedTerm = normalizeSearchTerm(searchTerm);

    return (wrappedA: RankableWrappedChannel, wrappedB: RankableWrappedChannel) => {
        const rankDifference =
            searchRank(wrappedA, normalizedTerm, weights, now) -
            searchRank(wrappedB, normalizedTerm, weights, now);

        if (rankDifference !== 0) {
            return rankDifference;
        }

        return sortChannelsByRecencyAndTypeAndDisplayName(wrappedA, wrappedB);
    };
}

export function rankingDebugRows(
    searchTerm: string,
    items: RankableWrappedChannel[],
    weights: RankPenaltyWeights = DEFAULT_RANK_PENALTY_WEIGHTS,
    now: number = Date.now(),
): RankingDebugRow[] {
    const normalizedTerm = normalizeSearchTerm(searchTerm);

    return [...items].
        sort(makeQuickSwitchSorter(normalizedTerm, weights, now)).
        map((wrapped) => {
            const penalties = rankPenalties(wrapped, normalizedTerm, weights, now);

            return {
                id: wrapped.channel.id,
                name: wrapped.channel.display_name || wrapped.name,
                channelType: wrapped.channel.type,
                rank: searchRank(wrapped, normalizedTerm, weights, now),
                archived: penalties.archived,
                deactivated: penalties.deactivated,
                nonPrefixMatch: penalties.nonPrefixMatch,
                conversationType: penalties.conversationType,
                activity: penalties.activity,
                hiddenInSidebar: penalties.hiddenInSidebar,
                isPrefixMatch: startsWithSearchTerm(wrapped, normalizedTerm),
                last_viewed_at: wrapped.last_viewed_at ? new Date(wrapped.last_viewed_at).toISOString() : 'never',
            };
        });
}

/**
 * Returns human-readable warnings when a stronger tier can lose to the sum of weaker ones.
 * Soft validation — intentional "break dominance" demos are useful in the playground.
 */
export function validatePenaltyDominance(weights: RankPenaltyWeights): string[] {
    const warnings: string[] = [];
    const maxType = weights.channel;
    const maxActivity = weights.noActivity;
    const hidden = weights.hiddenInSidebar;

    const weakerThanNonPrefix = maxType + maxActivity + hidden;
    if (weights.nonPrefixMatch <= weakerThanNonPrefix) {
        warnings.push(
            `nonPrefixMatch (${weights.nonPrefixMatch}) should be greater than channel + noActivity + hidden (${weakerThanNonPrefix})`,
        );
    }

    const weakerThanDeactivated = weights.nonPrefixMatch + maxType + maxActivity + hidden;
    if (weights.deactivated <= weakerThanDeactivated) {
        warnings.push(
            `deactivated (${weights.deactivated}) should be greater than nonPrefix + channel + noActivity + hidden (${weakerThanDeactivated})`,
        );
    }

    const weakerThanArchived = weights.deactivated + weights.nonPrefixMatch + maxType + maxActivity + hidden;
    if (weights.archived <= weakerThanArchived) {
        warnings.push(
            `archived (${weights.archived}) should be greater than deactivated + nonPrefix + channel + noActivity + hidden (${weakerThanArchived})`,
        );
    }

    if (weights.groupMessage <= maxActivity + hidden) {
        warnings.push(
            `groupMessage (${weights.groupMessage}) should be greater than noActivity + hidden (${maxActivity + hidden}) so a never-opened DM beats a recent GM`,
        );
    }

    if (weights.channel <= weights.groupMessage) {
        warnings.push(
            `channel (${weights.channel}) should be greater than groupMessage (${weights.groupMessage})`,
        );
    }

    if (weights.noActivity <= hidden) {
        warnings.push(
            `noActivity (${weights.noActivity}) should be greater than hiddenInSidebar (${hidden})`,
        );
    }

    return warnings;
}
