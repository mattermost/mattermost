// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Utility functions for converting between user-friendly time units (minutes/days)
 * and backend storage format (seconds) for Burn-on-Read configuration.
 */

// Base time unit constants
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_DAY = 86400;

// Duration options (time after opening before message is deleted)
export const BURN_ON_READ_DURATION_1_MINUTE = Number(SECONDS_PER_MINUTE); // 60
export const BURN_ON_READ_DURATION_5_MINUTES = 5 * SECONDS_PER_MINUTE; // 300
export const BURN_ON_READ_DURATION_10_MINUTES = 10 * SECONDS_PER_MINUTE; // 600
export const BURN_ON_READ_DURATION_30_MINUTES = 30 * SECONDS_PER_MINUTE; // 1800
export const BURN_ON_READ_DURATION_1_HOUR = Number(SECONDS_PER_HOUR); // 3600
export const BURN_ON_READ_DURATION_8_HOURS = 8 * SECONDS_PER_HOUR; // 28800

// Default duration value (10 minutes)
export const BURN_ON_READ_DURATION_DEFAULT = BURN_ON_READ_DURATION_10_MINUTES;

// Maximum time-to-live options (max time message can exist before being opened)
export const BURN_ON_READ_MAX_TTL_1_DAY = Number(SECONDS_PER_DAY); // 86400
export const BURN_ON_READ_MAX_TTL_3_DAYS = 3 * SECONDS_PER_DAY; // 259200
export const BURN_ON_READ_MAX_TTL_7_DAYS = 7 * SECONDS_PER_DAY; // 604800
export const BURN_ON_READ_MAX_TTL_14_DAYS = 14 * SECONDS_PER_DAY; // 1209600
export const BURN_ON_READ_MAX_TTL_30_DAYS = 30 * SECONDS_PER_DAY; // 2592000

// Default maximum time-to-live value (7 days)
export const BURN_ON_READ_MAX_TTL_DEFAULT = BURN_ON_READ_MAX_TTL_7_DAYS;

/**
 * Convert minutes to seconds for backend storage
 */
export function minutesToSeconds(minutes: number): number {
    return minutes * SECONDS_PER_MINUTE;
}

/**
 * Convert seconds to minutes for UI display
 */
export function secondsToMinutes(seconds: number): number {
    return Math.floor(seconds / SECONDS_PER_MINUTE);
}

/**
 * Convert days to seconds for backend storage
 */
export function daysToSeconds(days: number): number {
    return days * SECONDS_PER_DAY;
}

/**
 * Convert seconds to days for UI display
 */
export function secondsToDays(seconds: number): number {
    return Math.floor(seconds / SECONDS_PER_DAY);
}

/**
 * Parse string value from config and convert to minutes
 * Handles both old format (minutes string) and new format (seconds string)
 */
export function parseDurationConfigToMinutes(value: string | undefined): number {
    if (!value) {
        return 10; // Default 10 minutes
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
        return 10;
    }

    // If value is >= 60, assume it's in seconds (new format)
    // If value is < 60, assume it's in minutes (old format for backward compatibility)
    if (numValue >= 60) {
        return secondsToMinutes(numValue);
    }

    return numValue;
}

/**
 * Parse string value from config and convert to days
 * Handles both old format (days string) and new format (seconds string)
 */
export function parseMaxTTLConfigToDays(value: string | undefined): number {
    if (!value) {
        return 7; // Default 7 days
    }

    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
        return 7;
    }

    // If value is >= 100, assume it's in seconds (new format)
    // If value is < 100, assume it's in days (old format for backward compatibility)
    if (numValue >= 100) {
        return secondsToDays(numValue);
    }

    return numValue;
}
