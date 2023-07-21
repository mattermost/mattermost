// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CloudUsage, Limits} from '@mattermost/types/cloud';
import {useMemo} from 'react';

import {limitThresholds, LimitTypes} from 'utils/limits';

type LimitsKeys = typeof LimitTypes[keyof typeof LimitTypes];

interface MaybeLimitSummary {
    id: LimitsKeys;
    limit: number | undefined;
    usage: number;
}
export interface LimitSummary {
    id: LimitsKeys;
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

export default function useGetMultiplesExceededCloudLimit(usage: CloudUsage, limits: Limits): LimitsKeys[] {
    return useMemo(() => {
        if (Object.keys(limits).length === 0) {
            return [];
        }
        const maybeMessageHistoryLimit = limits.messages?.history;
        const messageHistoryUsage = usage.messages.history;

        const maybeFileStorageLimit = limits.files?.total_storage;
        const fileStorageUsage = usage.files.totalStorage;

        // Order matters for this array
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
            reduce((acc: LimitsKeys[], curr: LimitSummary) => {
                if ((curr.usage / curr.limit) > (limitThresholds.exceeded / 100)) {
                    acc.push(curr.id);
                    return acc;
                }
                return acc;
            }, [] as LimitsKeys[]);

        return highestLimit;
    }, [usage, limits]);
}
