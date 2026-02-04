// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    parseIconValue,
    formatIconValue,
    matchesSearch,
    DEFAULT_SEARCH_OPTIONS,
    type IconMetadata,
    type SearchOptions,
    type IconFormat,
} from './types';

describe('Icon Value Parsing', () => {
    describe('parseIconValue', () => {
        test('parses MDI icon format', () => {
            expect(parseIconValue('mdi:home')).toEqual({format: 'mdi', name: 'home'});
            expect(parseIconValue('mdi:account-circle')).toEqual({format: 'mdi', name: 'account-circle'});
        });

        test('parses Lucide icon format', () => {
            expect(parseIconValue('lucide:star')).toEqual({format: 'lucide', name: 'star'});
            expect(parseIconValue('lucide:arrow-right')).toEqual({format: 'lucide', name: 'arrow-right'});
        });

        test('parses Tabler icon format', () => {
            expect(parseIconValue('tabler:user')).toEqual({format: 'tabler', name: 'user'});
        });

        test('parses Feather icon format', () => {
            expect(parseIconValue('feather:bell')).toEqual({format: 'feather', name: 'bell'});
        });

        test('parses Simple icon format', () => {
            expect(parseIconValue('simple:github')).toEqual({format: 'simple', name: 'github'});
        });

        test('parses FontAwesome icon format', () => {
            expect(parseIconValue('fontawesome:check')).toEqual({format: 'fontawesome', name: 'check'});
        });

        test('parses custom SVG format', () => {
            expect(parseIconValue('customsvg:my-icon-123')).toEqual({format: 'customsvg', name: 'my-icon-123'});
        });

        test('parses inline SVG format', () => {
            expect(parseIconValue('svg:PHN2Zz4...')).toEqual({format: 'svg', name: 'PHN2Zz4...'});
        });

        test('handles empty value', () => {
            expect(parseIconValue('')).toEqual({format: 'none', name: ''});
        });

        test('handles invalid format', () => {
            expect(parseIconValue('invalid:icon')).toEqual({format: 'none', name: ''});
            expect(parseIconValue('just-text')).toEqual({format: 'none', name: ''});
            expect(parseIconValue(':no-prefix')).toEqual({format: 'none', name: ''});
        });

        test('handles icon names with special characters', () => {
            expect(parseIconValue('mdi:arrow-up-bold-circle-outline')).toEqual({
                format: 'mdi',
                name: 'arrow-up-bold-circle-outline',
            });
        });
    });

    describe('formatIconValue', () => {
        test('formats MDI icon', () => {
            expect(formatIconValue('mdi', 'home')).toBe('mdi:home');
        });

        test('formats Lucide icon', () => {
            expect(formatIconValue('lucide', 'star')).toBe('lucide:star');
        });

        test('formats Tabler icon', () => {
            expect(formatIconValue('tabler', 'user')).toBe('tabler:user');
        });

        test('formats Feather icon', () => {
            expect(formatIconValue('feather', 'bell')).toBe('feather:bell');
        });

        test('formats Simple icon', () => {
            expect(formatIconValue('simple', 'github')).toBe('simple:github');
        });

        test('formats FontAwesome icon', () => {
            expect(formatIconValue('fontawesome', 'check')).toBe('fontawesome:check');
        });

        test('formats custom SVG', () => {
            expect(formatIconValue('customsvg', 'my-id')).toBe('customsvg:my-id');
        });

        test('formats inline SVG', () => {
            expect(formatIconValue('svg', 'base64data')).toBe('svg:base64data');
        });

        test('returns empty string for none format', () => {
            expect(formatIconValue('none', 'anything')).toBe('');
        });

        test('returns empty string for empty name', () => {
            expect(formatIconValue('mdi', '')).toBe('');
        });

        test('round-trip with parseIconValue', () => {
            const formats: IconFormat[] = ['mdi', 'lucide', 'tabler', 'feather', 'simple', 'fontawesome', 'customsvg', 'svg'];

            for (const format of formats) {
                const name = 'test-icon';
                const formatted = formatIconValue(format, name);
                const parsed = parseIconValue(formatted);
                expect(parsed).toEqual({format, name});
            }
        });
    });
});

describe('Icon Search', () => {
    const testMetadata: IconMetadata = {
        name: 'account-circle',
        tags: ['user', 'profile', 'avatar'],
        aliases: ['person', 'member'],
    };

    describe('DEFAULT_SEARCH_OPTIONS', () => {
        test('has expected defaults', () => {
            expect(DEFAULT_SEARCH_OPTIONS.fields).toEqual(['name', 'tags', 'aliases']);
            expect(DEFAULT_SEARCH_OPTIONS.caseSensitive).toBe(false);
            expect(DEFAULT_SEARCH_OPTIONS.matchMode).toBe('contains');
            expect(DEFAULT_SEARCH_OPTIONS.limit).toBe(100);
        });
    });

    describe('matchesSearch', () => {
        test('matches by name', () => {
            const result = matchesSearch(testMetadata, 'account', DEFAULT_SEARCH_OPTIONS);
            expect(result.matched).toBe(true);
            expect(result.field).toBe('name');
            expect(result.value).toBe('account-circle');
        });

        test('matches by tag', () => {
            const result = matchesSearch(testMetadata, 'profile', DEFAULT_SEARCH_OPTIONS);
            expect(result.matched).toBe(true);
            expect(result.field).toBe('tags');
            expect(result.value).toBe('profile');
        });

        test('matches by alias', () => {
            const result = matchesSearch(testMetadata, 'person', DEFAULT_SEARCH_OPTIONS);
            expect(result.matched).toBe(true);
            expect(result.field).toBe('aliases');
            expect(result.value).toBe('person');
        });

        test('returns not matched for no hits', () => {
            const result = matchesSearch(testMetadata, 'xyz123', DEFAULT_SEARCH_OPTIONS);
            expect(result.matched).toBe(false);
            expect(result.field).toBeUndefined();
        });

        test('case-insensitive by default', () => {
            expect(matchesSearch(testMetadata, 'ACCOUNT', DEFAULT_SEARCH_OPTIONS).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'USER', DEFAULT_SEARCH_OPTIONS).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'Person', DEFAULT_SEARCH_OPTIONS).matched).toBe(true);
        });

        test('case-sensitive when enabled', () => {
            const options: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, caseSensitive: true};
            expect(matchesSearch(testMetadata, 'ACCOUNT', options).matched).toBe(false);
            expect(matchesSearch(testMetadata, 'account', options).matched).toBe(true);
        });

        test('contains match mode', () => {
            const options: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, matchMode: 'contains'};
            expect(matchesSearch(testMetadata, 'circle', options).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'count', options).matched).toBe(true);
        });

        test('startsWith match mode', () => {
            const options: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, matchMode: 'startsWith'};
            expect(matchesSearch(testMetadata, 'account', options).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'circle', options).matched).toBe(false);
        });

        test('exact match mode', () => {
            const options: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, matchMode: 'exact'};
            expect(matchesSearch(testMetadata, 'account-circle', options).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'account', options).matched).toBe(false);
            expect(matchesSearch(testMetadata, 'user', options).matched).toBe(true); // exact tag match
        });

        test('respects field restrictions', () => {
            const nameOnly: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, fields: ['name']};
            expect(matchesSearch(testMetadata, 'account', nameOnly).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'user', nameOnly).matched).toBe(false); // tag won't match

            const tagsOnly: SearchOptions = {...DEFAULT_SEARCH_OPTIONS, fields: ['tags']};
            expect(matchesSearch(testMetadata, 'user', tagsOnly).matched).toBe(true);
            expect(matchesSearch(testMetadata, 'account', tagsOnly).matched).toBe(false);
        });

        test('priority: name > aliases > tags', () => {
            // When name matches, returns name even if tag also matches
            const metadata: IconMetadata = {
                name: 'user-icon',
                tags: ['user'],
                aliases: ['user-alias'],
            };

            const result = matchesSearch(metadata, 'user', DEFAULT_SEARCH_OPTIONS);
            expect(result.field).toBe('name');
        });
    });
});
