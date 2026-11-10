// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

export const APPROACHING_EXPIRY_DAYS = 7;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ExpiryPreset = 'none' | '7d' | '30d' | '90d' | '1y' | 'custom';

export const PRESET_DAYS: Record<Exclude<ExpiryPreset, 'none' | 'custom'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
};

export function endOfLocalDayPlusDays(days: number): number {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

export function endOfLocalDayFromIsoDate(isoDate: string): number {
    // isoDate is YYYY-MM-DD from <input type="date">; parse as local date.
    const [y, m, d] = isoDate.split('-').map(Number);
    if (!y || !m || !d) {
        return 0;
    }
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

// The presets and custom dates resolve to end-of-local-day, which can sit up to
// ~24h beyond the server's cap of "now + maxLifetimeDays" (the server measures an
// exact duration from the moment of creation, not end-of-day). Clamp the submitted
// value to that cap so the in-range presets (including the default, which equals the
// cap) and the maximum selectable custom date are accepted. The server evaluates its
// cap slightly later than this, so the clamped value stays safely under it.
export function clampExpiresAtToMaxLifetime(expiresAt: number, maxLifetimeDays: number): number {
    if (expiresAt > 0 && maxLifetimeDays > 0) {
        return Math.min(expiresAt, Date.now() + (maxLifetimeDays * MS_PER_DAY));
    }
    return expiresAt;
}

export function todayIso(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export function isoPlusDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export function defaultCustomExpiryDate(maxLifetimeDays: number): string {
    if (maxLifetimeDays > 0) {
        return isoPlusDays(Math.max(1, Math.min(30, maxLifetimeDays)));
    }
    return isoPlusDays(30);
}

export function isExpiryPresetAllowed(preset: ExpiryPreset, maxLifetimeDays: number): boolean {
    if (preset === 'none' || preset === 'custom') {
        return true;
    }
    return maxLifetimeDays <= 0 || PRESET_DAYS[preset] <= maxLifetimeDays;
}

export function defaultExpiryPreset(maxLifetimeDays: number, enforceExpiry: boolean): ExpiryPreset {
    // A configured maximum lifetime (> 0) implies tokens must expire, so the
    // "No expiry" option is not offered and a bounded preset is the default.
    if (!enforceExpiry) {
        return 'none';
    }
    const presets: ExpiryPreset[] = ['30d', '7d'];
    for (const p of presets) {
        if (isExpiryPresetAllowed(p, maxLifetimeDays)) {
            return p;
        }
    }
    return 'custom';
}

export function resolveTokenExpiresAt(expiryPreset: ExpiryPreset, customExpiryDate: string, allowExpiry = true): number {
    if (!allowExpiry || expiryPreset === 'none') {
        return 0;
    }
    if (expiryPreset === 'custom') {
        return endOfLocalDayFromIsoDate(customExpiryDate);
    }
    return endOfLocalDayPlusDays(PRESET_DAYS[expiryPreset]);
}

export type TokenStatus = 'active' | 'expired' | 'inactive';

export function deriveTokenStatus(token: {is_active: boolean; expires_at?: number}): TokenStatus {
    if (!token.is_active) {
        return 'inactive';
    }
    if (token.expires_at && token.expires_at > 0 && token.expires_at < Date.now()) {
        return 'expired';
    }
    return 'active';
}

export function mapServerErrorIdToMessage(errorId?: string, maxDays?: number): React.ReactNode | null {
    switch (errorId) {
    case 'app.user_access_token.expires_at_required.app_error':
    case 'expires_at_required':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryRequired'
                defaultMessage='An expiry date is required.'
            />
        );
    case 'app.user_access_token.expires_at_in_past.app_error':
    case 'expires_at_in_past':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryInPast'
                defaultMessage='Expiry must be in the future.'
            />
        );
    case 'app.user_access_token.expires_at_too_far.app_error':
    case 'expires_at_too_far':
        return (
            <FormattedMessage
                id='user.settings.tokens.expiryTooFar'
                defaultMessage='Expiry can be at most {days, number} {days, plural, one {day} other {days}} from now.'
                values={{days: maxDays ?? 0}}
            />
        );
    default:
        return null;
    }
}

export function getExpiryValidationError(expiryPreset: ExpiryPreset, customExpiryDate: string, maxLifetimeDays: number, enforceExpiry: boolean, allowExpiry = true): React.ReactNode | null {
    if (!allowExpiry) {
        return null;
    }

    const expiresAt = resolveTokenExpiresAt(expiryPreset, customExpiryDate);
    if (expiryPreset === 'custom' && expiresAt <= 0) {
        return mapServerErrorIdToMessage('expires_at_required');
    }
    if (enforceExpiry && expiresAt <= 0) {
        return mapServerErrorIdToMessage('expires_at_required');
    }
    if (expiresAt > 0 && expiresAt <= Date.now()) {
        return mapServerErrorIdToMessage('expires_at_in_past');
    }
    if (expiresAt > 0 && maxLifetimeDays > 0) {
        const maxAllowed = endOfLocalDayPlusDays(maxLifetimeDays);
        if (expiresAt > maxAllowed) {
            return mapServerErrorIdToMessage('expires_at_too_far', maxLifetimeDays);
        }
    }
    return null;
}
