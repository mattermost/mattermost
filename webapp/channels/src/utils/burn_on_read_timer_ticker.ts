// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Global timer ticker for burn-on-read countdown displays.
 * Uses a single self-correcting timer to broadcast tick events to all subscribers.
 * This prevents O(n) intervals when displaying many burn-on-read posts.
 *
 * Features:
 * - Self-correcting drift prevention (aligns to second boundaries)
 * - Battery optimization (pauses when tab hidden)
 * - Thread-safe snapshot iteration
 * - Single timestamp per tick for perfect synchronization
 */

type TickCallback = (now: number) => void;

class BurnOnReadTimerTicker {
    private subscribers: Set<TickCallback> = new Set();
    private timerId: ReturnType<typeof setTimeout> | null = null;
    private readonly tickInterval = 1000; // 1 second

    /**
     * Subscribe to timer tick events
     * Callback receives current timestamp for efficient time calculations
     * Automatically starts the ticker if this is the first subscriber
     */
    public subscribe(callback: TickCallback): () => void {
        this.subscribers.add(callback);

        // Start ticker if this is the first subscriber
        if (this.subscribers.size === 1) {
            this.start();
        }

        // Return unsubscribe function
        return () => {
            this.unsubscribe(callback);
        };
    }

    /**
     * Unsubscribe from timer tick events
     * Automatically stops the ticker if this was the last subscriber
     */
    private unsubscribe(callback: TickCallback): void {
        this.subscribers.delete(callback);

        // Stop ticker if no more subscribers
        if (this.subscribers.size === 0) {
            this.stop();
        }
    }

    /**
     * Start the global ticker with drift correction
     * Aligns ticks to second boundaries for accurate countdown displays
     */
    private start(): void {
        if (this.timerId) {
            return;
        }

        // Listen for visibility changes to pause/resume ticker
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // Start ticking (will self-correct for drift)
        this.scheduleNextTick();
    }

    /**
     * Schedule the next tick aligned to the second boundary
     * Uses recursive setTimeout with drift correction instead of setInterval
     */
    private scheduleNextTick(): void {
        const now = Date.now();
        const msUntilNextSecond = this.tickInterval - (now % this.tickInterval);

        this.timerId = setTimeout(() => {
            this.tick();
            this.scheduleNextTick(); // Recursive - self-correcting!
        }, msUntilNextSecond);
    }

    /**
     * Execute a tick: broadcast current time to all subscribers
     * Uses snapshot iteration to prevent concurrent modification issues
     */
    private tick(): void {
        // Skip tick if tab is hidden (battery optimization)
        if (document.hidden) {
            return;
        }

        const now = Date.now();

        // Snapshot subscribers before iteration to prevent concurrent modification bugs
        // If a callback unsubscribes during iteration, it won't affect other callbacks
        const snapshot = Array.from(this.subscribers);

        snapshot.forEach((callback) => {
            try {
                callback(now); // Pass timestamp for efficient calculations
            } catch (error) {
                // Prevent one component's error from breaking all timers
                // Errors are silently swallowed to keep ticker running
            }
        });
    }

    /**
     * Handle visibility changes for battery optimization
     * Fires immediate catch-up tick when tab becomes visible
     */
    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            // Tab became visible - fire immediate catch-up tick
            // This ensures UI shows current time immediately after tab switch
            this.tick();
        }

        // Note: No need to pause explicitly - tick() checks document.hidden
    };

    /**
     * Stop the global ticker
     */
    private stop(): void {
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }

        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    /**
     * Get subscriber count (for testing/debugging)
     */
    public getSubscriberCount(): number {
        return this.subscribers.size;
    }

    /**
     * Force cleanup (for testing)
     */
    public cleanup(): void {
        this.stop();
        this.subscribers.clear();
    }
}

// Singleton instance
export const timerTicker = new BurnOnReadTimerTicker();
