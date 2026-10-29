// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {timezonesDiffer} from './use_recipient_timezone';

describe('timezonesDiffer', () => {
    it('should not treat a timezone as different from itself', () => {
        expect(timezonesDiffer('America/New_York', 'America/New_York')).toBe(false);
    });

    it('should not treat differently named timezones that always share a clock as different', () => {
        expect(timezonesDiffer('America/New_York', 'America/Toronto')).toBe(false);
    });

    it('should treat timezones with different offsets as different', () => {
        expect(timezonesDiffer('America/New_York', 'Asia/Tokyo')).toBe(true);
    });

    it('should treat timezones as different when only one of them observes daylight saving', () => {
        // Both are UTC+0 in winter, but London moves to UTC+1 in summer
        expect(timezonesDiffer('Europe/London', 'Africa/Abidjan')).toBe(true);
    });

    it('should treat timezones as different when their daylight saving changes fall on different dates', () => {
        // Both are UTC+2 in winter and UTC+3 in summer, but Egypt and the EU change their clocks on different dates
        expect(timezonesDiffer('Africa/Cairo', 'Europe/Helsinki')).toBe(true);
    });

    it('should not treat invalid timezones as different', () => {
        expect(timezonesDiffer('Not/A_Zone', 'America/New_York')).toBe(false);
    });
});
