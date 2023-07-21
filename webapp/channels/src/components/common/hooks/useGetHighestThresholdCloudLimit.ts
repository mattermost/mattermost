// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CloudUsage, Limits} from '@mattermost/types/cloud';
import {useMemo} from 'react';

import {limitThresholds, LimitTypes} from 'utils/limits';

interface MaybeLimitSummary {
    id: typeof LimitTypes[keyof typeof LimitTypes];
    limit: number | undefined;
    usage: number;
}
export interface LimitSummary {
    id: typeof LimitTypes[keyof typeof LimitTypes];
    limit: number;
    usage: number;
}

function refineToDefined(...args: MaybeLimitSummary[]): LimitSummary[] {
    return args.reduce((acc: LimitSummary[], maybeLimitType: MaybeLimitSummary) => {
        if (maybeLimitType.limit !== undefined) {
            acc.push(maybeLimitType as LimitSummary);
        }
        return acc;
    }, []);
}

// Hook used to tell if some limit status should be surfaced to the user
// for further attention, for example for prompting the user to upgrade
// from a free cloud instance to a paid cloud instance.
export default function useGetHighestThresholdCloudLimit(usage: CloudUsage, limits: Limits): LimitSummary | false {
    return useMemo(() => {
        if (Object.keys(limits).length === 0) {
            return false;
        }
        const maybeMessageHistoryLimit = limits.messages?.history;
        const messageHistoryUsage = usage.messages.history;

        const maybeFileStorageLimit = limits.files?.total_storage;
        const fileStorageUsage = usage.files.totalStorage;

        // Order matters for this array. The designs specify:
        // > Show the plan limit that is the highest.
        // > Otherwise if there is a tie,
        // > default to showing Message History first,
        // > File storage second,
        // > and App limit third.
        const highestLimit = refineToDefined(
            {
                id: LimitTypes.messageHistory,
                limit: maybeMessageHistoryLimit,
                usage: messageHistoryUsage,
            },
            {
                id: LimitTypes.fileStorage,
                limit: maybeFileStorageLimit,
                usage: fileStorageUsage,
            },
        ).
            reduce((acc: LimitSummary | false, curr: LimitSummary) => {
                if (!acc) {
                    if (curr.limit && curr.limit > 0) {
                        return curr;
                    }
                    return acc;
                }
                if ((curr.usage / curr.limit) > (acc.usage / acc.limit)) {
                    return curr;
                }
                return acc;
            }, false);

        // Either no limit category was defined (!highestLimit)
        // or no limit meets the minimum threshold for needing attention
        const noLimitNeedsAttention = !highestLimit || (highestLimit.usage / highestLimit.limit) < (limitThresholds.warn / 100);
        if (noLimitNeedsAttention) {
            return false;
        }
        return highestLimit;
    }, [usage, limits]);
}
