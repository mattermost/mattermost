// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileSizes} from 'utils/file_utils';
import {limitThresholds, LimitTypes} from 'utils/limits';

import useGetHighestThresholdCloudLimit from './useGetHighestThresholdCloudLimit';
import type {LimitSummary} from './useGetHighestThresholdCloudLimit';

jest.mock('react', () => ({
    useMemo: (fn: () => LimitSummary) => fn(),
}));

const zeroUsage = {
    files: {
        totalStorage: 0,
        totalStorageLoaded: true,
    },
    messages: {
        history: 0,
        historyLoaded: true,
    },
    boards: {
        cards: 0,
        cardsLoaded: true,
    },
    integrations: {
        enabled: 0,
        enabledLoaded: true,
    },
    teams: {
        active: 0,
        cloudArchived: 0,
        teamsLoaded: true,
    },
};

describe('useGetHighestThresholdCloudLimit', () => {
    const messageHistoryLimit = 10000;
    const filesLimit = FileSizes.Gigabyte;
    const okMessageUsage = Math.floor((limitThresholds.warn / 100) * messageHistoryLimit) - 1;
    const warnMessageUsage = Math.ceil((limitThresholds.warn / 100) * messageHistoryLimit) + 1;
    const tests = [
        {
            label: 'reports no highest limit if there are no limits',
            limits: {},
            usage: zeroUsage,
            expected: false,
        },
        {
            label: 'reports no highest limit if no limit exceeds the warn threshold',
            limits: {
                messages: {
                    history: messageHistoryLimit,
                },
            },
            usage: {
                ...zeroUsage,
                messages: {
                    ...zeroUsage.messages,
                    history: okMessageUsage,
                },
            },
            expected: false,
        },
        {
            label: 'reports a highest limit if one exceeds a threshold',
            limits: {
                messages: {
                    history: messageHistoryLimit,
                },
            },
            usage: {
                ...zeroUsage,
                messages: {
                    ...zeroUsage.messages,
                    history: warnMessageUsage,
                },
            },
            expected: {
                id: LimitTypes.messageHistory,
                limit: messageHistoryLimit,
                usage: warnMessageUsage,
            },
        },
        {
            label: 'messages beats files in tie',
            limits: {
                messages: {
                    history: messageHistoryLimit,
                },
                files: {
                    total_storage: filesLimit,
                },
            },
            usage: {
                ...zeroUsage,
                messages: {
                    ...zeroUsage.messages,
                    history: messageHistoryLimit,
                },
                files: {
                    ...zeroUsage.files,
                    totralStorage: filesLimit,
                },
            },
            expected: {
                id: LimitTypes.messageHistory,
                limit: messageHistoryLimit,
                usage: messageHistoryLimit,
            },
        },
        {
            label: 'files beats messages if higher',
            limits: {
                messages: {
                    history: messageHistoryLimit,
                },
                files: {
                    total_storage: filesLimit,
                },
            },
            usage: {
                ...zeroUsage,
                messages: {
                    ...zeroUsage.messages,
                    history: messageHistoryLimit,
                },
                files: {
                    ...zeroUsage.files,
                    totalStorage: filesLimit + FileSizes.Megabyte,
                },
            },
            expected: {
                id: LimitTypes.fileStorage,
                limit: filesLimit,
                usage: filesLimit + FileSizes.Megabyte,
            },
        },
    ];
    tests.forEach((t: typeof tests[0]) => {
        test(t.label, () => {
            const actual = useGetHighestThresholdCloudLimit(t.usage, t.limits);
            expect(t.expected).toEqual(actual);
        });
    });
});
