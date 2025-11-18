// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Global timer ticker for burn-on-read countdown displays.
 * Uses a single setInterval to broadcast tick events to all subscribers.
 * This prevents O(n) intervals when displaying many burn-on-read posts.
 */

type TickCallback = () => void;

class BurnOnReadTimerTicker {
    private subscribers: Set<TickCallback> = new Set();
    private intervalId: NodeJS.Timeout | null = null;
    private readonly tickInterval = 1000; // 1 second

    /**
     * Subscribe to timer tick events
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
     * Start the global ticker
     */
    private start(): void {
        if (this.intervalId) {
            return;
        }

        this.intervalId = setInterval(() => {
            // Broadcast tick to all subscribers
            this.subscribers.forEach((callback) => {
                try {
                    callback();
                } catch (error) {
                    // Prevent one component's error from breaking all timers
                    // Error is silently caught to maintain timer stability
                }
            });
        }, this.tickInterval);
    }

    /**
     * Stop the global ticker
     */
    private stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
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
