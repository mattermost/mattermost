// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withBackupValue} from './useGetUsageDeltas';

describe('withBackupValue', () => {
    const tests = [
        {
            label: 'if limits not loaded, assumes no limit',
            maybeLimit: undefined,
            limitsLoaded: false,
            expected: Number.MAX_VALUE,
        },
        {
            label: 'if limits not loaded, assumes no limit even if there is data',
            maybeLimit: 4,
            limitsLoaded: false,
            expected: Number.MAX_VALUE,
        },
        {
            label: 'if limits loaded and the limit is 0, returns 0',
            maybeLimit: 0,
            limitsLoaded: true,
            expected: 0,
        },
        {
            label: 'if limits loaded and the limit is non-zero , returns the value',
            maybeLimit: 5,
            limitsLoaded: true,
            expected: 5,
        },
        {
            label: 'if limits loaded and the limit is undefined, returns max value',
            maybeLimit: undefined,
            limitsLoaded: true,
            expected: Number.MAX_VALUE,
        },
    ];

    tests.forEach((t) => {
        it(t.label, () => {
            expect(withBackupValue(t.maybeLimit, t.limitsLoaded)).toBe(t.expected);
        });
    });
});
