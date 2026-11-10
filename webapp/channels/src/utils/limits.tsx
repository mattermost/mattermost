// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CSSProperties} from 'react';
import type {FormatNumberOptions} from 'react-intl';

import type {ProgressBarProps} from '@mattermost/compass-ui/components/progress-bar';
import type {Limits} from '@mattermost/types/cloud';

import {FileSizes} from './file_utils';

export function asGBString(bits: number, formatNumber: (b: number, options: FormatNumberOptions) => string): string {
    return `${formatNumber(bits / FileSizes.Gigabyte, {maximumFractionDigits: 1})}GB`;
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

function getUsageBarFillColor(percent: number): string {
    if (percent < limitThresholds.warn) {
        return 'var(--online-indicator)';
    }
    if (percent < limitThresholds.danger || percent >= limitThresholds.exceeded) {
        return 'var(--away-indicator)';
    }
    return 'var(--dnd-indicator)';
}

// Compass semanticColors uses fixed thresholds, so usage bars drive the fill color themselves.
// When exceeded, the bar shows a partial warning fill over a danger-colored track.
export function getUsageProgressBarProps(percent: number, width: string): Pick<ProgressBarProps, 'value' | 'size' | 'style'> {
    const exceeded = percent >= limitThresholds.exceeded;

    return {
        value: exceeded ? 91 : Math.max(0, percent),
        size: 'large',
        style: {
            width,
            '--button-bg': getUsageBarFillColor(percent),
            backgroundColor: exceeded ? 'var(--dnd-indicator)' : undefined,
        } as CSSProperties,
    };
}

export const LimitTypes = {
    messageHistory: 'messageHistory',
    fileStorage: 'fileStorage',
} as const;
