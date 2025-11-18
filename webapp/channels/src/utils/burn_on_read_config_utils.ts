// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Utility functions for converting between user-friendly time units (minutes/days)
 * and backend storage format (seconds) for Burn-on-Read configuration.
 */

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 86400;

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
