// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Formats milliseconds into HH:MM:SS or MM:SS format for countdown timer display
 * @param ms - Milliseconds remaining
 * @returns Formatted string like "10:00", "05:30", "1:30:00"
 */
export function formatTimeRemaining(ms: number): string {
    // Ensure non-negative
    const remaining = Math.max(0, ms);

    const totalSeconds = Math.ceil(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // If >= 1 hour, show HH:MM:SS format
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Otherwise show MM:SS format
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Calculates remaining milliseconds from expiration timestamp
 * @param expireAt - Unix timestamp (in milliseconds or seconds) when the post expires
 * @returns Milliseconds remaining (negative if already expired)
 */
export function calculateRemainingTime(expireAt: number): number {
    // If expireAt looks like seconds (< 10000000000), convert to milliseconds
    // This handles backend inconsistency between seconds and milliseconds
    const expireAtMs = expireAt < 10000000000 ? expireAt * 1000 : expireAt;
    return expireAtMs - Date.now();
}

/**
 * Checks if the timer is in warning state (≤ 1 minute remaining)
 * @param remainingMs - Milliseconds remaining
 * @returns True if ≤ 60 seconds remaining
 */
export function isTimerInWarningState(remainingMs: number): boolean {
    return remainingMs <= 60000; // 60 seconds
}

/**
 * Checks if the timer has expired
 * @param remainingMs - Milliseconds remaining
 * @returns True if timer has expired (≤ 0)
 */
export function isTimerExpired(remainingMs: number): boolean {
    return remainingMs <= 0;
}

/**
 * Gets the appropriate ARIA announcement interval based on remaining time
 * Returns interval in seconds for screen reader announcements
 * @param remainingMs - Milliseconds remaining
 * @returns Announcement interval in milliseconds
 */
export function getAriaAnnouncementInterval(remainingMs: number): number {
    // Final minute: announce every 10 seconds
    if (remainingMs <= 60000) {
        return 10000;
    }

    // Otherwise: announce every 60 seconds
    return 60000;
}

/**
 * Formats time remaining for screen reader announcement
 * @param ms - Milliseconds remaining
 * @returns Human-readable announcement like "10 minutes remaining" or "30 seconds remaining"
 */
export function formatAriaAnnouncement(ms: number): string {
    const remaining = Math.max(0, ms);
    const totalSeconds = Math.ceil(remaining / 1000);

    if (totalSeconds === 0) {
        return 'Message deleting now';
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0 && seconds > 0) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ${seconds} ${seconds === 1 ? 'second' : 'seconds'} remaining`;
    }
    if (minutes > 0) {
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} remaining`;
    }
    return `${seconds} ${seconds === 1 ? 'second' : 'seconds'} remaining`;
}
