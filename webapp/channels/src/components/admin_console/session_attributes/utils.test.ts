// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {SessionAttributeField} from './utils';
import {
    DURATION_PRESETS_SECONDS,
    formatDuration,
    getDisplayType,
    getSessionAttrs,
    getSessionDisplayName,
    isServerSourced,
} from './utils';

function makeField(overrides: Partial<SessionAttributeField> = {}): SessionAttributeField {
    return {
        id: 'field-id',
        name: 'attribute',
        type: 'text',
        group_id: 'session_attributes',
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        object_type: 'session',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
        ...overrides,
    };
}

function options(...names: string[]): PropertyFieldOption[] {
    return names.map((name, index) => ({id: `opt-${index}`, name}));
}

function makeFieldWithAttrs(extra: Record<string, unknown>): SessionAttributeField {
    return makeField({
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
            ...extra,
        } as SessionAttributeField['attrs'],
    });
}

describe('session_attributes utils', () => {
    describe('getDisplayType', () => {
        it('maps a select with true/false options to Boolean', () => {
            const field = makeField({type: 'select', attrs: {sort_order: 0, visibility: 'when_set', value_type: '', options: options('true', 'false')}});
            expect(getDisplayType(field)).toBe('Boolean');
        });

        it('maps a select with other options to Enum', () => {
            const field = makeField({type: 'select', attrs: {sort_order: 0, visibility: 'when_set', value_type: '', options: options('wifi', 'vpn')}});
            expect(getDisplayType(field)).toBe('Enum');
        });

        it('maps a select with no options to Enum', () => {
            const field = makeField({type: 'select'});
            expect(getDisplayType(field)).toBe('Enum');
        });

        it('maps text fields to String', () => {
            expect(getDisplayType(makeField({type: 'text', name: 'ip_address'}))).toBe('String');
            expect(getDisplayType(makeField({type: 'text', name: 'app_version'}))).toBe('String');
            expect(getDisplayType(makeField({type: 'text', name: 'user_agent'}))).toBe('String');
            expect(getDisplayType(makeField({type: 'text', name: 'device_model'}))).toBe('String');
        });

        it('maps non-text, non-select field types to String', () => {
            expect(getDisplayType(makeField({type: 'date', name: 'last_seen'}))).toBe('String');
        });
    });

    describe('isServerSourced', () => {
        it('is true for the request-derived server names', () => {
            expect(isServerSourced('ip_address')).toBe(true);
            expect(isServerSourced('user_agent_platform')).toBe(true);
            expect(isServerSourced('user_agent_os')).toBe(true);
            expect(isServerSourced('user_agent_browser_name')).toBe(true);
            expect(isServerSourced('user_agent_browser_version')).toBe(true);
        });

        it('is false for client-sourced names', () => {
            expect(isServerSourced('network_status')).toBe(false);
            expect(isServerSourced('client_type')).toBe(false);
        });

        it('does not flag the seeded but non-request-derived client_ip_address', () => {
            expect(isServerSourced('client_ip_address')).toBe(false);
        });

        it('does not flag names that merely match a source token', () => {
            expect(isServerSourced('source_ip_address')).toBe(false);
            expect(isServerSourced('user_agent')).toBe(false);
            expect(isServerSourced('client_user_agent')).toBe(false);
            expect(isServerSourced('ip_address_country')).toBe(false);
        });
    });

    describe('getSessionAttrs', () => {
        it('reads valid tunables', () => {
            const field = makeFieldWithAttrs({enabled: true, ttl_seconds: 300, grace_period_seconds: 60, platforms: ['desktop', 'browser']});
            expect(getSessionAttrs(field)).toEqual({enabled: true, ttl_seconds: 300, grace_period_seconds: 60, platforms: ['desktop', 'browser']});
        });

        it('drops unknown/garbage platform tokens', () => {
            const field = makeFieldWithAttrs({platforms: ['desktop', 'tablet', 'web', 'mobile', 42]});
            expect(getSessionAttrs(field).platforms).toEqual(['desktop', 'mobile']);
        });

        it('treats non-array platforms as empty', () => {
            const field = makeFieldWithAttrs({platforms: 'desktop'});
            expect(getSessionAttrs(field).platforms).toEqual([]);
        });

        it('defaults non-number ttl/grace to 0', () => {
            const stringDurations = makeFieldWithAttrs({ttl_seconds: '300', grace_period_seconds: null});
            expect(getSessionAttrs(stringDurations).ttl_seconds).toBe(0);
            expect(getSessionAttrs(stringDurations).grace_period_seconds).toBe(0);

            const missingDurations = makeFieldWithAttrs({});
            expect(getSessionAttrs(missingDurations).ttl_seconds).toBe(0);
            expect(getSessionAttrs(missingDurations).grace_period_seconds).toBe(0);
        });

        it('treats missing or non-true enabled as disabled', () => {
            expect(getSessionAttrs(makeFieldWithAttrs({})).enabled).toBe(false);
            expect(getSessionAttrs(makeFieldWithAttrs({enabled: false})).enabled).toBe(false);
            expect(getSessionAttrs(makeFieldWithAttrs({enabled: 'yes'})).enabled).toBe(false);
        });

        it('does not throw when attrs is absent', () => {
            const field = makeField();
            Reflect.deleteProperty(field, 'attrs');
            expect(() => getSessionAttrs(field)).not.toThrow();
            expect(getSessionAttrs(field)).toEqual({enabled: false, ttl_seconds: 0, grace_period_seconds: 0, platforms: []});
        });
    });

    describe('getSessionDisplayName', () => {
        it('uses a trimmed display_name when present', () => {
            expect(getSessionDisplayName(makeFieldWithAttrs({display_name: '  Client IP  '}))).toBe('Client IP');
        });

        it('falls back to the field name when display_name is absent', () => {
            expect(getSessionDisplayName(makeField({name: 'ip_address'}))).toBe('ip_address');
        });

        it('falls back to the field name when display_name is blank', () => {
            expect(getSessionDisplayName(makeFieldWithAttrs({display_name: '   '}))).toBe('attribute');
        });

        it('does not throw when attrs is absent', () => {
            const field = makeField({name: 'ip_address'});
            Reflect.deleteProperty(field, 'attrs');
            expect(getSessionDisplayName(field)).toBe('ip_address');
        });
    });

    describe('formatDuration', () => {
        it('renders the exact preset labels', () => {
            expect(formatDuration(30)).toBe('30s');
            expect(formatDuration(60)).toBe('1m');
            expect(formatDuration(300)).toBe('5m');
            expect(formatDuration(3600)).toBe('1h');
            expect(formatDuration(86400)).toBe('24h');
        });

        it('renders non-preset values via the fallback', () => {
            expect(formatDuration(45)).toBe('45s');
            expect(formatDuration(90)).toBe('2m');
            expect(formatDuration(7200)).toBe('2h');
            expect(formatDuration(172800)).toBe('2d');
        });
    });

    describe('DURATION_PRESETS_SECONDS', () => {
        it('exposes the supported preset values', () => {
            expect([...DURATION_PRESETS_SECONDS]).toEqual([30, 60, 300, 3600, 86400]);
        });
    });
});
