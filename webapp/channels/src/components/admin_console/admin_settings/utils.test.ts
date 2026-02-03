// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isSetByEnv, parseIntNonNegative, parseIntNonZero, parseIntZeroOrMin} from './utils';

describe('isSetByEnv', () => {
    it('properly returns true when the environment set the path', () => {
        const result = isSetByEnv({
            AnalyticsSettings: {
                MaxUsersForStatistics: true,
            },
        }, 'AnalyticsSettings.MaxUsersForStatistics');
        expect(result).toBe(true);
    });

    it('properly returns false when the environment does not set the path', () => {
        const result = isSetByEnv({
            AnalyticsSettings: {
                MaxUsersForStatistics: false,
            },
        }, 'AnalyticsSettings.MaxUsersForStatistics');
        expect(result).toBe(false);
    });

    it('properly returns false when the path does not exist', () => {
        let result = isSetByEnv({}, 'AnalyticsSettings.MaxUsersForStatistics');
        expect(result).toBe(false);

        result = isSetByEnv({
            AnalyticsSettings: {
                MaxUsersForStatistics: true,
            },
        }, 'not.available.path');
        expect(result).toBe(false);
    });
});

describe('parseIntNonNegative', () => {
    it('properly parse a positive number', () => {
        let result = parseIntNonNegative('123');
        expect(result).toBe(123);

        result = parseIntNonNegative(123);
        expect(result).toBe(123);
    });

    it('properly defaults to default value if negative', () => {
        let result = parseIntNonNegative('-1', 100);
        expect(result).toBe(100);

        result = parseIntNonNegative(-1, 100);
        expect(result).toBe(100);
    });

    it('properly defaults to default value if not a number', () => {
        const result = parseIntNonNegative('hello world', 100);
        expect(result).toBe(100);
    });

    it('string float values are rounded down', () => {
        let result = parseIntNonNegative('1.99999', 100);
        expect(result).toBe(1);

        result = parseIntNonNegative(199.99999, 100);
        expect(result).toBe(199.99999);
    });

    it('properly defaults to 0 if no default is given', () => {
        let result = parseIntNonNegative('-123');
        expect(result).toBe(0);

        result = parseIntNonNegative(-123);
        expect(result).toBe(0);

        result = parseIntNonNegative('hello world');
        expect(result).toBe(0);

        result = parseIntNonNegative('-1.9999999');
        expect(result).toBe(0);
    });
});

describe('parseIntZeroOrMin', () => {
    it('parse a positive number', () => {
        let result = parseIntZeroOrMin('123', 100);
        expect(result).toBe(123);

        result = parseIntZeroOrMin(123, 100);
        expect(result).toBe(123);
    });

    it('defaults to 0 if the value is negative or 0', () => {
        let result = parseIntZeroOrMin('-1', 100);
        expect(result).toBe(0);

        result = parseIntZeroOrMin(-1, 100);
        expect(result).toBe(0);

        result = parseIntZeroOrMin('0', 100);
        expect(result).toBe(0);

        result = parseIntZeroOrMin(0, 100);
        expect(result).toBe(0);
    });

    it('defaults to minimum value if lower', () => {
        let result = parseIntZeroOrMin('99', 100);
        expect(result).toBe(100);

        result = parseIntZeroOrMin(99, 100);
        expect(result).toBe(100);
    });

    it('defaults to 0 value if not a number', () => {
        const result = parseIntZeroOrMin('hello world', 100);
        expect(result).toBe(0);
    });

    it('string float values are rounded down', () => {
        let result = parseIntZeroOrMin('199.99999', 100);
        expect(result).toBe(199);

        result = parseIntZeroOrMin(199.99999, 100);
        expect(result).toBe(199.99999);
    });

    it('defaults to 1 if no min is given', () => {
        let result = parseIntZeroOrMin('2');
        expect(result).toBe(2);

        result = parseIntZeroOrMin(0.00000000001);
        expect(result).toBe(1);

        result = parseIntZeroOrMin(1.00000000001);
        expect(result).toBe(1.00000000001);
    });

    it('minimum allow float numbers', () => {
        let result = parseIntZeroOrMin('1', 1.9999);
        expect(result).toBe(1.9999);

        result = parseIntZeroOrMin(1.9998, 1.9999);
        expect(result).toBe(1.9999);
    });
});

describe('parseIntNonZero', () => {
    it('parse a positive number', () => {
        let result = parseIntNonZero('123', 100, 50);
        expect(result).toBe(123);

        result = parseIntNonZero(123, 100, 50);
        expect(result).toBe(123);
    });

    it('defaults to default value if the value lower than mininum value', () => {
        let result = parseIntNonZero('-1', 100, 0);
        expect(result).toBe(100);

        result = parseIntNonZero(-1, 100, 0);
        expect(result).toBe(100);

        result = parseIntNonZero('150', 100, 200);
        expect(result).toBe(100);

        result = parseIntNonZero(150, 100, 200);
        expect(result).toBe(100);
    });

    it('minimum value defaults to 1', () => {
        let result = parseIntNonZero('1', 100);
        expect(result).toBe(1);

        result = parseIntNonZero('0', 100);
        expect(result).toBe(100);

        result = parseIntNonZero(1, 100);
        expect(result).toBe(1);

        result = parseIntNonZero(0.999999999, 100);
        expect(result).toBe(100);
    });

    it('default value defaults to 1', () => {
        let result = parseIntNonZero('99', undefined, 100);
        expect(result).toBe(1);

        result = parseIntNonZero('hello world');
        expect(result).toBe(1);

        result = parseIntNonZero(99.9999, undefined, 100);
        expect(result).toBe(1);
    });

    it('defaults to default value if not a number', () => {
        const result = parseIntNonZero('hello world', 100);
        expect(result).toBe(100);
    });

    it('string float values are rounded down', () => {
        let result = parseIntNonZero('199.99999', 100);
        expect(result).toBe(199);

        result = parseIntNonZero(199.99999, 100);
        expect(result).toBe(199.99999);
    });

    it('default and minimum allow float numbers', () => {
        let result = parseIntNonZero('1', 1.9999, 2);
        expect(result).toBe(1.9999);

        result = parseIntNonZero(1.9998, 10, 1.9999);
        expect(result).toBe(10);
    });

    it('minimum and default allow negative numbers', () => {
        let result = parseIntNonZero('1', -10, 2);
        expect(result).toBe(-10);

        result = parseIntNonZero('-5', 10, -2);
        expect(result).toBe(10);

        result = parseIntNonZero('-5', 10, -6);
        expect(result).toBe(-5);
    });
});
