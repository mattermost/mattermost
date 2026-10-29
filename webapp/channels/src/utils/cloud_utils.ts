// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const FREEMIUM_TO_ENTERPRISE_TRIAL_LENGTH_DAYS = 30;

export function daysUntil(end?: number, simulatedCurrentTimeMs?: number) {
    let now = new Date();

    if (simulatedCurrentTimeMs) {
        now = new Date(simulatedCurrentTimeMs);
    }

    const expiration = new Date(end || 0);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
}
