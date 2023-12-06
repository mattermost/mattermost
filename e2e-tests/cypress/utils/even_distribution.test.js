// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getTestFilesIdentifier} from './even_distribution';

describe('getTestFilesIdentifier', () => {
    it('should return expected output', () => {
        const testCases = [
            {numberOfTestFiles: 5, part: 1, of: 4, outStart: 0, outEnd: 2, outCount: 2},
            {numberOfTestFiles: 5, part: 2, of: 4, outStart: 2, outEnd: 3, outCount: 1},
            {numberOfTestFiles: 5, part: 3, of: 4, outStart: 3, outEnd: 4, outCount: 1},
            {numberOfTestFiles: 5, part: 4, of: 4, outStart: 4, outEnd: 5, outCount: 1},

            {numberOfTestFiles: 10, part: 1, of: 4, outStart: 0, outEnd: 3, outCount: 3},
            {numberOfTestFiles: 10, part: 2, of: 4, outStart: 3, outEnd: 6, outCount: 3},
            {numberOfTestFiles: 10, part: 3, of: 4, outStart: 6, outEnd: 8, outCount: 2},
            {numberOfTestFiles: 10, part: 4, of: 4, outStart: 8, outEnd: 10, outCount: 2},

            {numberOfTestFiles: 410, part: 1, of: 8, outStart: 0, outEnd: 52, outCount: 52},
            {numberOfTestFiles: 410, part: 2, of: 8, outStart: 52, outEnd: 104, outCount: 52},
            {numberOfTestFiles: 410, part: 3, of: 8, outStart: 104, outEnd: 155, outCount: 51},
            {numberOfTestFiles: 410, part: 4, of: 8, outStart: 155, outEnd: 206, outCount: 51},
            {numberOfTestFiles: 410, part: 5, of: 8, outStart: 206, outEnd: 257, outCount: 51},
            {numberOfTestFiles: 410, part: 6, of: 8, outStart: 257, outEnd: 308, outCount: 51},
            {numberOfTestFiles: 410, part: 7, of: 8, outStart: 308, outEnd: 359, outCount: 51},
            {numberOfTestFiles: 410, part: 8, of: 8, outStart: 359, outEnd: 410, outCount: 51},
        ];

        testCases.forEach((testCase) => {
            const actual = getTestFilesIdentifier(testCase.numberOfTestFiles, testCase.part, testCase.of);

            expect(testCase.outStart).toEqual(actual.start);
            expect(testCase.outEnd).toEqual(actual.end);
            expect(testCase.outCount).toEqual(actual.count);
        });
    });
});
