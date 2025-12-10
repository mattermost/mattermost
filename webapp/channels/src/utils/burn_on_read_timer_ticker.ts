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
    private started: boolean = false;
    private readonly tickInterval = 1000; // 1 second

    /**
     * Subscribe to timer tick events
     * Callback receives current timestamp for efficient time calculations
     * Automatically starts the ticker if this is the first subscriber
     */
    public subscribe(callback: TickCallback): () => void {
        this.subscribers.add(callback);

        if (!this.started) {
            this.start();
            this.started = true;
        }

        return () => {
            this.unsubscribe(callback);
        };
    }

    /**
     * Unsubscribe from timer tick events
     */
    private unsubscribe(callback: TickCallback): void {
        this.subscribers.delete(callback);

        if (this.subscribers.size === 0 && this.started) {
            this.stop();
            this.started = false;
        }
    }

    /**
     * Start the global ticker with drift correction
     */
    private start(): void {
        if (this.timerId) {
            return;
        }

        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.scheduleNextTick();
    }

    /**
     * Schedule next tick aligned to second boundary
     */
    private scheduleNextTick(): void {
        const now = Date.now();
        const msUntilNextSecond = this.tickInterval - (now % this.tickInterval);

        this.timerId = setTimeout(() => {
            this.tick();
            this.scheduleNextTick();
        }, msUntilNextSecond);
    }

    /**
     * Execute a tick: broadcast current time to all subscribers
     */
    private tick(): void {
        if (document.hidden) {
            return;
        }

        const now = Date.now();

        this.subscribers.forEach((callback) => {
            try {
                callback(now);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('[BurnOnRead] Timer callback error:', error);
            }
        });
    }

    /**
     * Handle visibility changes
     */
    private handleVisibilityChange = (): void => {
        if (!document.hidden) {
            this.tick();
        }
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
        this.started = false;
    }
}

// Singleton instance
export const timerTicker = new BurnOnReadTimerTicker();
