// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FileSizes} from 'utils/file_utils';
import {limitThresholds, LimitTypes} from 'utils/limits';

import useGetMultiplesExceededCloudLimit, {LimitSummary} from './useGetMultiplesExceededCloudLimit';

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
    const exceededMessageUsage = Math.ceil((limitThresholds.exceeded / 100) * messageHistoryLimit) + 1;

    const tests = [
        {
            label: 'reports no limits surpassed',
            limits: {},
            usage: zeroUsage,
            expected: [],
        },
        {
            label: 'reports messages limit surpasded',
            limits: {
                messages: {
                    history: messageHistoryLimit,
                },
            },
            usage: {
                ...zeroUsage,
                messages: {
                    ...zeroUsage.messages,
                    history: exceededMessageUsage,
                },
            },
            expected: [LimitTypes.messageHistory],
        },
        {
            label: 'reports files limit surpassed',
            limits: {
                files: {
                    total_storage: filesLimit,
                },
            },
            usage: {
                ...zeroUsage,
                files: {
                    ...zeroUsage.files,
                    totalStorage: FileSizes.Gigabyte * 2,
                },
            },
            expected: [LimitTypes.fileStorage],
        },
        {
            label: 'reports messages and files limit surpasded',
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
                    history: exceededMessageUsage,
                },
                files: {
                    ...zeroUsage.files,
                    totalStorage: FileSizes.Gigabyte * 2,
                },
            },
            expected: [LimitTypes.messageHistory, LimitTypes.fileStorage],
        },
    ];

    tests.forEach((t: typeof tests[0]) => {
        test(t.label, () => {
            const actual = useGetMultiplesExceededCloudLimit(t.usage, t.limits);
            expect(t.expected).toEqual(actual);
        });
    });
});
