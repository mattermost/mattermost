// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {FormatNumberOptions} from 'react-intl';

import type {CloudUsage, Limits} from '@mattermost/types/cloud';

import {FileSizes} from './file_utils';

export function asGBString(bits: number, formatNumber: (b: number, options: FormatNumberOptions) => string): string {
    return `${formatNumber(bits / FileSizes.Gigabyte, {maximumFractionDigits: 1})}GB`;
}

export function inK(num: number): string {
    return `${Math.floor(num / 1000)}K`;
}

// usage percent meaning 0-100 (for use in usage bar)
export function toUsagePercent(usage: number, limit: number): number {
    return Math.floor((usage / limit) * 100);
}

// These are to be used when we need values
// even if network requests are failing for some reason.
// Use as a fallback.
export const fallbackStarterLimits = {
    messages: {
        history: 10000,
    },
    files: {
        totalStorage: Number(FileSizes.Gigabyte),
    },
    teams: {
        active: 1,
    },
};

// A positive usage value means they are over the limit. This function simply tells you whether ANY LIMIT has been reached/surpassed.
export function anyUsageDeltaExceededLimit(deltas: CloudUsage) {
    let foundAPositive = false;

    // JSON.parse recursively moves through the object tree, passing the key and value post transformation
    // We can use the `reviver` argument to see if any of those arguments are numbers, and negative.
    JSON.parse(JSON.stringify(deltas), (key, value) => {
        if (typeof value === 'number' && value > 0) {
            foundAPositive = true;
        }
    });
    return foundAPositive;
}

export function hasSomeLimits(limits: Limits): boolean {
    return Object.keys(limits).length > 0;
}

export const limitThresholds = Object.freeze({
    ok: 0,
    warn: 50,
    danger: 66,
    reached: 100,
    exceeded: 100.000001,
});

export const LimitTypes = {
    messageHistory: 'messageHistory',
    fileStorage: 'fileStorage',
} as const;
