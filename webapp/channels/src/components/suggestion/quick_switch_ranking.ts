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

// Results are ranked on one additive scale so that comparing any two of them is consistent with
// comparing them through a third. Each weight is larger than the sum of every weaker one, so a
// stronger reason to demote always outranks any combination of weaker reasons.
export const DEFAULT_RANK_PENALTY_WEIGHTS: RankPenaltyWeights = {
    archived: 72,
    deactivated: 36,

    // How recently the user engaged with a conversation is the primary signal: one opened within the
    // last month leads, a staler one comes next, and one that was never opened trails both.
    noActivity: 24,
    staleActivity: 12,

    // Within a recency band a name the search term is a prefix of beats one that only contains it
    // somewhere in the middle.
    nonPrefixMatch: 6,

    // Within a recency band and prefix tier a direct message outranks a group message, which
    // outranks a channel.
    channel: 4,
    groupMessage: 2,

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

// A group message has no name of its own: its display name is its members listed alphabetically, so
// it starts with a searched username only when that member happens to sort first. That is
// coincidental rather than a real prefix match, so group messages never count as one.
export function startsWithSearchTerm(wrapped: RankableWrappedChannel, searchTerm: string) {
    const channel = wrapped.channel;

    if (channel.type === Constants.GM_CHANNEL) {
        return false;
    }

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
    if (channelType === Constants.DM_CHANNEL) {
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
        activity: activityRankPenalty(wrapped, weights, now),
        nonPrefixMatch: startsWithSearchTerm(wrapped, normalizedTerm) ? 0 : weights.nonPrefixMatch,
        conversationType: typeRankPenalty(channel.type, weights),
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
        penalties.activity +
        penalties.nonPrefixMatch +
        penalties.conversationType +
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
 * Soft validation for playground experiments — flags when a stronger production tier can lose to
 * the sum of weaker ones on the activity-first scale. Activity bands are mutually exclusive, so
 * only the largest activity penalty is counted among weaker tiers.
 */
export function validatePenaltyDominance(weights: RankPenaltyWeights): string[] {
    const warnings: string[] = [];
    const maxType = weights.channel;
    const maxActivity = Math.max(weights.noActivity, weights.staleActivity);
    const hidden = weights.hiddenInSidebar;

    if (weights.staleActivity <= weights.nonPrefixMatch + maxType + hidden) {
        warnings.push(
            `staleActivity (${weights.staleActivity}) should be greater than nonPrefix + channel + hidden (${weights.nonPrefixMatch + maxType + hidden})`,
        );
    }

    if (weights.noActivity <= weights.staleActivity + weights.nonPrefixMatch + maxType + hidden) {
        // noActivity must beat a stale match that also has every weaker demotion
        warnings.push(
            `noActivity (${weights.noActivity}) should be greater than stale + nonPrefix + channel + hidden (${weights.staleActivity + weights.nonPrefixMatch + maxType + hidden})`,
        );
    }

    const weakerThanDeactivated = maxActivity + weights.nonPrefixMatch + maxType + hidden;
    if (weights.deactivated <= weakerThanDeactivated) {
        warnings.push(
            `deactivated (${weights.deactivated}) should be greater than activity + nonPrefix + type + hidden (${weakerThanDeactivated})`,
        );
    }

    const weakerThanArchived = weights.deactivated + weakerThanDeactivated;
    if (weights.archived <= weakerThanArchived) {
        warnings.push(
            `archived (${weights.archived}) should be greater than deactivated + weaker tiers (${weakerThanArchived})`,
        );
    }

    if (weights.nonPrefixMatch <= maxType + hidden) {
        warnings.push(
            `nonPrefixMatch (${weights.nonPrefixMatch}) should be greater than channel + hidden (${maxType + hidden})`,
        );
    }

    if (weights.channel <= weights.groupMessage) {
        warnings.push(
            `channel (${weights.channel}) should be greater than groupMessage (${weights.groupMessage})`,
        );
    }

    if (weights.groupMessage <= hidden) {
        warnings.push(
            `groupMessage (${weights.groupMessage}) should be greater than hiddenInSidebar (${hidden})`,
        );
    }

    return warnings;
}
