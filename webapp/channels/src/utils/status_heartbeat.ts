// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import WebSocketClient from 'client/web_websocket_client';

// StatusHeartbeat sends periodic heartbeats to the server for accurate status tracking.
// This enables the AccurateStatuses feature which tracks LastActivityAt with higher precision.

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;
let currentChannelId = '';

// Default interval - will be overridden by server config
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

/**
 * Initialize the status heartbeat service.
 * Should be called once when the user logs in and the AccurateStatuses feature is enabled.
 *
 * @param intervalSeconds - The heartbeat interval in seconds (from server config)
 */
export function initStatusHeartbeat(intervalSeconds?: number): void {
    if (isInitialized) {
        return;
    }

    const intervalMs = (intervalSeconds || 30) * 1000;

    // Start the heartbeat interval
    heartbeatInterval = setInterval(() => {
        sendHeartbeat();
    }, intervalMs);

    isInitialized = true;

    // eslint-disable-next-line no-console
    console.log(`Status heartbeat initialized (interval: ${intervalMs / 1000}s)`);

    // Send an initial heartbeat immediately
    sendHeartbeat();
}

/**
 * Stop the status heartbeat service.
 * Should be called when the user logs out or the feature is disabled.
 */
export function stopStatusHeartbeat(): void {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    isInitialized = false;

    // eslint-disable-next-line no-console
    console.log('Status heartbeat stopped');
}

/**
 * Update the current channel ID for heartbeat messages.
 * This is called when the user switches channels.
 *
 * @param channelId - The new channel ID
 */
export function updateHeartbeatChannelId(channelId: string): void {
    currentChannelId = channelId;
}

/**
 * Send a heartbeat message to the server.
 * The heartbeat includes window active state and current channel.
 */
function sendHeartbeat(): void {
    const windowActive = typeof window !== 'undefined' ? window.isActive : false;

    WebSocketClient.sendMessage('activity_heartbeat', {
        window_active: windowActive,
        channel_id: currentChannelId,
    });
}

/**
 * Check if the heartbeat service is currently running.
 */
export function isHeartbeatRunning(): boolean {
    return isInitialized && heartbeatInterval !== null;
}

/**
 * Restart the heartbeat service with a new interval.
 * Useful when the server configuration changes.
 *
 * @param intervalSeconds - The new heartbeat interval in seconds
 */
export function restartHeartbeat(intervalSeconds: number): void {
    stopStatusHeartbeat();
    initStatusHeartbeat(intervalSeconds);
}
