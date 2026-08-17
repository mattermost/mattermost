// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TimestampFormat} from '@mattermost/types/config';

import {
    getTimestampFormatLabel,
    getTimestampFormatOptionDisplayNameValues,
    getTimestampFormatShortLabel,
    getTimestampFormatTimeExample,
    resolveAdminShowTimestampSeconds,
    shouldWrapPostTimestamp,
    supportsTimestampSeconds,
} from './datetime_display_format';

describe('datetime_display_format', () => {
    test('supportsTimestampSeconds only for standard and date and time formats', () => {
        expect(supportsTimestampSeconds(TimestampFormat.STANDARD)).toBe(true);
        expect(supportsTimestampSeconds(TimestampFormat.DATE_AND_TIME)).toBe(true);
        expect(supportsTimestampSeconds(TimestampFormat.RELATIVE)).toBe(false);
    });

    test('shouldWrapPostTimestamp for inline date and time only', () => {
        expect(shouldWrapPostTimestamp(TimestampFormat.DATE_AND_TIME, false)).toBe(true);
        expect(shouldWrapPostTimestamp(TimestampFormat.DATE_AND_TIME, true)).toBe(false);
        expect(shouldWrapPostTimestamp(TimestampFormat.STANDARD, false)).toBe(false);
        expect(shouldWrapPostTimestamp(TimestampFormat.RELATIVE, false)).toBe(false);
    });

    test('getTimestampFormatTimeExample reflects clock and seconds settings', () => {
        expect(getTimestampFormatTimeExample()).toBe('4:32 PM');
        expect(getTimestampFormatTimeExample({useMilitaryTime: true})).toBe('16:32');
        expect(getTimestampFormatTimeExample({showTimestampSeconds: true})).toBe('4:32:07 PM');
        expect(getTimestampFormatTimeExample({useMilitaryTime: true, showTimestampSeconds: true})).toBe('16:32:07');
    });

    test('getTimestampFormatOptionDisplayNameValues matches time example helper', () => {
        expect(getTimestampFormatOptionDisplayNameValues({showTimestampSeconds: true})).toEqual({
            timeExample: '4:32:07 PM',
        });
    });

    test('getTimestampFormatLabel uses selected clock format in examples', () => {
        const intl = {
            formatMessage: jest.fn(({defaultMessage}, values) => defaultMessage.replace('{timeExample}', values?.timeExample)),
        };

        expect(getTimestampFormatLabel(TimestampFormat.STANDARD, intl as any, {useMilitaryTime: true})).toBe('Standard (example: 16:32)');
        expect(getTimestampFormatLabel(TimestampFormat.DATE_AND_TIME, intl as any, {useMilitaryTime: true})).toBe('Date and Time (example: Jun 1, 16:32)');
        expect(getTimestampFormatLabel(TimestampFormat.RELATIVE, intl as any)).toBe('Relative (example: 3 hours ago)');
    });

    test('getTimestampFormatShortLabel returns the bare format name', () => {
        const intl = {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
        };

        expect(getTimestampFormatShortLabel(TimestampFormat.STANDARD, intl as any)).toBe('Standard');
        expect(getTimestampFormatShortLabel(TimestampFormat.DATE_AND_TIME, intl as any)).toBe('Date and Time');
        expect(getTimestampFormatShortLabel(TimestampFormat.RELATIVE, intl as any)).toBe('Relative');
    });

    test('resolveAdminShowTimestampSeconds uses admin console state when present', () => {
        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: false}},
            {'DisplaySettings.ShowTimestampSeconds': true},
        )).toBe(true);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: true}},
            {'DisplaySettings.ShowTimestampSeconds': false},
        )).toBe(false);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: true}},
            {},
        )).toBe(true);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: false}},
            {'DisplaySettings.ShowTimestampSeconds': 'true'},
        )).toBe(true);

        expect(resolveAdminShowTimestampSeconds(
            {DisplaySettings: {ShowTimestampSeconds: true}},
            {'DisplaySettings.ShowTimestampSeconds': 'false'},
        )).toBe(false);
    });
});
