// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import testCases from '../../../testdata/condition-test-cases.json';

import {executeCondition} from './conditions';
import {PropertyField} from './properties';

describe('conditions JSON test cases', () => {
    describe('executeCondition', () => {
        for (const testCase of testCases) {
            it(testCase.name, () => {
                const result = executeCondition(
                    testCase.condition,
                    testCase.fields as PropertyField[],
                    testCase.values
                );
                expect(result).toBe(testCase.shouldPass);
            });
        }
    });
});