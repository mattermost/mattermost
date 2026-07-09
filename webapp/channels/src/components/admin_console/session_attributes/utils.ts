// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserPropertyField} from '@mattermost/types/properties_user';

export type SessionAttributeField = UserPropertyField;

export const SESSION_ATTRIBUTES_TARGET_TYPE = 'system';

export type SessionAttributeDisplayType = 'String' | 'Boolean' | 'Enum';

export type SessionPlatform = 'desktop' | 'mobile' | 'browser';

export const SESSION_PLATFORMS: SessionPlatform[] = ['desktop', 'mobile', 'browser'];

export type SessionAttributeTunables = {
    enabled: boolean;
    ttl_seconds: number;
    grace_period_seconds: number;
    platforms: SessionPlatform[];
};

// Mirrors the server's request-derived field names (SessionAttributesRequestDerivedFieldNames in
// server/public/model/session_attributes.go): only these are populated by the server rather than the
// client, so only these surface as "Server"-sourced. Notably client_ip_address is seeded but is NOT
// request-derived, so it must not be flagged.
export const SERVER_SOURCED_NAMES = [
    'ip_address',
    'user_agent_platform',
    'user_agent_os',
    'user_agent_browser_name',
    'user_agent_browser_version',
] as const;

const DURATION_PRESET_LABELS: Record<number, string> = {
    30: '30s',
    60: '1m',
    300: '5m',
    3600: '1h',
    86400: '24h',
};

// Integer-like keys enumerate in ascending numeric order, so this stays sorted.
export const DURATION_PRESETS_SECONDS = Object.keys(DURATION_PRESET_LABELS).map(Number);

// Precedence: select options decide Boolean vs Enum; everything else is String.
export function getDisplayType(field: SessionAttributeField): SessionAttributeDisplayType {
    if (field.type === 'select') {
        const optionNames = field.attrs.options?.map((option) => option.name.toLowerCase()) ?? [];
        const isBoolean = optionNames.length === 2 && optionNames.includes('true') && optionNames.includes('false');
        return isBoolean ? 'Boolean' : 'Enum';
    }

    return 'String';
}

export function isServerSourced(name: string): boolean {
    return (SERVER_SOURCED_NAMES as readonly string[]).includes(name.toLowerCase());
}

export function formatDuration(seconds: number): string {
    const preset = DURATION_PRESET_LABELS[seconds];
    if (preset) {
        return preset;
    }

    if (seconds < 60) {
        return `${seconds}s`;
    }
    if (seconds < 3600) {
        return `${Math.round(seconds / 60)}m`;
    }
    if (seconds < 86400) {
        return `${Math.round(seconds / 3600)}h`;
    }
    return `${Math.round(seconds / 86400)}d`;
}

// These keys are server-provided and absent from the typed attrs shape, so read them defensively.
export function getSessionAttrs(field: SessionAttributeField): SessionAttributeTunables {
    const attrs = (field.attrs ?? {}) as Record<string, unknown>;
    const platforms = Array.isArray(attrs.platforms) ? (attrs.platforms as unknown[]).filter(
        (platform): platform is SessionPlatform => SESSION_PLATFORMS.includes(platform as SessionPlatform),
    ) : [];

    return {
        enabled: attrs.enabled === true,
        ttl_seconds: typeof attrs.ttl_seconds === 'number' ? attrs.ttl_seconds : 0,
        grace_period_seconds: typeof attrs.grace_period_seconds === 'number' ? attrs.grace_period_seconds : 0,
        platforms,
    };
}

export function getSessionDisplayName(field: SessionAttributeField): string {
    return field.attrs?.display_name?.trim() || field.name;
}
