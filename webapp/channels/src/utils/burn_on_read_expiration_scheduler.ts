// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {handlePostExpired} from 'actions/burn_on_read_deletion';

import type {DispatchFunc} from 'types/store';

/**
 * Hybrid Expiration Scheduler for Burn-on-Read messages.
 *
 * Strategy:
 * - Short delays (< 15 min): setTimeout for exact timing
 * - Long delays (>= 15 min): Polling every 60s to handle sleep/throttling/setTimeout limits
 * - Visibility API: Check when tab becomes visible
 *
 * This approach avoids setTimeout limitations while maintaining exact timing for short delays.
 * Backend job is authoritative; this is UX optimization only.
 */
class BurnOnReadExpirationScheduler {
    private nextTimerId: ReturnType<typeof setTimeout> | null = null;
    private pollingIntervalId: ReturnType<typeof setInterval> | null = null;
    private postExpirations: Map<string, number> = new Map();
    private dispatch: DispatchFunc | null = null;
    private initialized = false;

    // Grace period: Don't immediately delete posts that just expired
    // This prevents premature deletion due to:
    // - Network latency
    // - Clock skew between client/server
    // - Stale data on initial load
    // Backend job is authoritative; this is just UX optimization
    private readonly gracePeriodMs = 2000; // 2 seconds

    // Hybrid strategy thresholds
    // 15 min threshold covers typical revealed message timer (10 min) with setTimeout
    // Longer delays use polling which is more battery-efficient for multi-day timers
    private readonly shortDelayThreshold = 15 * 60 * 1000; // 15 minutes
    private readonly pollingInterval = 60 * 1000; // Check every 60 seconds for long delays

    /**
     * Initialize the scheduler with Redux dispatch (idempotent - safe to call multiple times)
     */
    public initialize(dispatch: DispatchFunc): void {
        this.dispatch = dispatch;

        // Idempotent: only attach listener once to avoid duplicates on hot reload/re-mounts
        if (!this.initialized) {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
            this.initialized = true;
        }
    }

    /**
     * Register a post with expiration timestamps
     *
     * @param postId - Post ID
     * @param expireAt - Reveal timer expiration (when user clicked reveal)
     * @param maxExpireAt - Maximum TTL expiration (from post creation)
     */
    public registerPost(postId: string, expireAt: number | null, maxExpireAt: number | null): void {
        const activeExpiration = this.getActiveExpiration(expireAt, maxExpireAt);

        if (!activeExpiration) {
            // No expiration set, remove from tracking
            this.unregisterPost(postId);
            return;
        }

        const now = Date.now();
        const timeSinceExpiration = now - activeExpiration;

        // Only immediately expire if past grace period
        // This prevents premature deletion on initial load due to network lag
        if (timeSinceExpiration > this.gracePeriodMs) {
            this.handleExpiration(postId);
            return;
        }

        // Update expiration time
        const previousExpiration = this.postExpirations.get(postId);
        this.postExpirations.set(postId, activeExpiration);

        // Only recompute schedule if this is a new post or expiration changed
        if (previousExpiration !== activeExpiration) {
            this.recomputeSchedule();
        }
    }

    /**
     * Unregister a post (when deleted, navigated away, etc.)
     */
    public unregisterPost(postId: string): void {
        if (this.postExpirations.delete(postId)) {
            this.recomputeSchedule();
        }
    }

    /**
     * Find the post that expires next and schedule appropriate timer
     * Hybrid strategy: setTimeout for short delays, polling for long delays
     */
    private recomputeSchedule(): void {
        // Clear existing timers
        if (this.nextTimerId) {
            clearTimeout(this.nextTimerId);
            this.nextTimerId = null;
        }
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }

        // Early return if nothing to track
        if (this.postExpirations.size === 0) {
            return;
        }

        // Find the post that expires soonest
        const {postId: nextPostId, expireAt: nextExpiration} = this.getNextExpiring();

        if (!nextPostId) {
            return;
        }

        // Schedule timer for expiration + grace period
        // This ensures we only check once the grace period has fully elapsed
        const delay = Math.max(0, (nextExpiration + this.gracePeriodMs) - Date.now());

        // Hybrid strategy: short delay = setTimeout, long delay = polling
        if (delay < this.shortDelayThreshold) {
            // Short delay: use setTimeout for exact timing
            this.nextTimerId = setTimeout(() => {
                this.checkAndExpirePosts();
            }, delay);
        } else {
            // Long delay: use polling to handle sleep/throttling
            // Check immediately in case we woke from sleep
            this.checkAndExpirePosts();

            // Then poll periodically
            this.pollingIntervalId = setInterval(() => {
                this.checkAndExpirePosts();
            }, this.pollingInterval);
        }
    }

    /**
     * Get the next post that will expire
     */
    private getNextExpiring(): {postId: string | null; expireAt: number} {
        let nextPostId: string | null = null;
        let nextExpiration = Infinity;

        for (const [postId, expireAt] of this.postExpirations.entries()) {
            if (expireAt < nextExpiration) {
                nextExpiration = expireAt;
                nextPostId = postId;
            }
        }

        return {postId: nextPostId, expireAt: nextExpiration};
    }

    /**
     * Check all posts and expire any that have passed their expiration time + grace period
     */
    public checkAndExpirePosts(): void {
        const now = Date.now();
        const expiredPosts: string[] = [];

        // Find all expired posts (including grace period in the check)
        // This is where the grace period should be applied, not just in registerPost
        for (const [postId, expireAt] of this.postExpirations.entries()) {
            if (expireAt + this.gracePeriodMs <= now) {
                expiredPosts.push(postId);
            }
        }

        // Batch delete from tracking (avoids mutation during iteration)
        for (const postId of expiredPosts) {
            this.postExpirations.delete(postId);
        }

        // Dispatch batch expiration if dispatch is available
        if (expiredPosts.length > 0 && this.dispatch) {
            // Dispatch each expiration
            for (const postId of expiredPosts) {
                try {
                    this.dispatch(handlePostExpired(postId));
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('[BurnOnRead] Failed to handle post expiration:', postId, error);
                }
            }
        }

        // Reschedule if we expired any posts
        // - If we expired posts and more remain: schedule the next one
        // - If we expired posts and none remain: recomputeSchedule() exits early
        if (expiredPosts.length > 0) {
            this.recomputeSchedule();
        }
    }

    /**
     * Handle visibility change - check expirations when tab becomes visible
     */
    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            // Tab became visible, check for expired posts
            this.checkAndExpirePosts();

            // Reschedule in case timing changed while tab was hidden
            if (this.postExpirations.size > 0) {
                this.recomputeSchedule();
            }
        }
    };

    /**
     * Handle single post expiration (used by registerPost for immediate expiration)
     */
    private handleExpiration(postId: string): void {
        // Remove from tracking
        this.postExpirations.delete(postId);

        // Dispatch expiration action
        if (this.dispatch) {
            try {
                this.dispatch(handlePostExpired(postId));
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[BurnOnRead] Failed to handle post expiration:', postId, error);
            }
        }
    }

    /**
     * Determine which timer is active (whichever expires first)
     */
    private getActiveExpiration(expireAt: number | null, maxExpireAt: number | null): number | null {
        if (!expireAt && !maxExpireAt) {
            return null;
        }
        if (!expireAt) {
            return maxExpireAt;
        }
        if (!maxExpireAt) {
            return expireAt;
        }

        // Whichever expires first
        return Math.min(expireAt, maxExpireAt);
    }

    /**
     * Cleanup on logout/unmount
     */
    public cleanup(): void {
        if (this.nextTimerId) {
            clearTimeout(this.nextTimerId);
            this.nextTimerId = null;
        }
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
        this.postExpirations.clear();
        this.dispatch = null;
        this.initialized = false;
    }

    /**
     * Get current state (for debugging/testing)
     */
    public getState(): {activeTimers: number; nextExpiration: number | null} {
        if (this.postExpirations.size === 0) {
            return {activeTimers: 0, nextExpiration: null};
        }

        let nextExpiration = Infinity;
        for (const expireAt of this.postExpirations.values()) {
            if (expireAt < nextExpiration) {
                nextExpiration = expireAt;
            }
        }

        return {
            activeTimers: this.postExpirations.size,
            nextExpiration: nextExpiration === Infinity ? null : nextExpiration,
        };
    }
}

// Singleton instance
export const expirationScheduler = new BurnOnReadExpirationScheduler();
