// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    tablerLibrary,
    getTablerIconPaths,
    getTablerIconMetadata,
    getAllTablerIconNames,
} from 'components/channel_settings_modal/icon_libraries/tabler_icons';

describe('Tabler Icons Library', () => {
    describe('tablerLibrary', () => {
        test('has correct id and prefix', () => {
            expect(tablerLibrary.id).toBe('tabler');
            expect(tablerLibrary.prefix).toBe('tabler:');
            expect(tablerLibrary.name).toBe('Tabler');
        });

        test('has icons loaded', () => {
            expect(tablerLibrary.iconCount).toBeGreaterThan(0);
        });

        test('has categories', () => {
            expect(tablerLibrary.categories.length).toBeGreaterThan(0);
            expect(tablerLibrary.categories[0]).toHaveProperty('id');
            expect(tablerLibrary.categories[0]).toHaveProperty('name');
            expect(tablerLibrary.categories[0]).toHaveProperty('iconNames');
        });
    });

    describe('getTablerIconPaths', () => {
        test('returns paths for known icons', () => {
            // 'user' is a common icon that should exist
            const paths = getTablerIconPaths('user');
            expect(paths).toBeDefined();
            expect(Array.isArray(paths)).toBe(true);
            if (paths) {
                expect(paths.length).toBeGreaterThan(0);
            }
        });

        test('returns undefined for unknown icons', () => {
            const paths = getTablerIconPaths('definitely-not-a-real-icon-xyz123');
            expect(paths).toBeUndefined();
        });
    });

    describe('getTablerIconMetadata', () => {
        test('returns metadata for known icons', () => {
            const metadata = getTablerIconMetadata('user');
            expect(metadata).toBeDefined();
            if (metadata) {
                expect(metadata.name).toBe('user');
                expect(metadata.tags).toBeDefined();
                expect(Array.isArray(metadata.tags)).toBe(true);
            }
        });

        test('returns undefined for unknown icons', () => {
            const metadata = getTablerIconMetadata('definitely-not-a-real-icon-xyz123');
            expect(metadata).toBeUndefined();
        });
    });

    describe('getAllTablerIconNames', () => {
        test('returns array of icon names', () => {
            const names = getAllTablerIconNames();
            expect(Array.isArray(names)).toBe(true);
            expect(names.length).toBeGreaterThan(0);
        });

        test('returns sorted array', () => {
            const names = getAllTablerIconNames();
            const sorted = [...names].sort();
            expect(names).toEqual(sorted);
        });
    });

    describe('search', () => {
        test('finds icons by name', () => {
            const results = tablerLibrary.search('user');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].library).toBe('tabler');
            expect(results[0].name).toContain('user');
        });

        test('respects limit option', () => {
            const results = tablerLibrary.search('a', {limit: 5});
            expect(results.length).toBeLessThanOrEqual(5);
        });

        test('returns empty array for no matches', () => {
            const results = tablerLibrary.search('xyznotarealicon123456');
            expect(results).toEqual([]);
        });

        test('returns empty array for empty query', () => {
            const results = tablerLibrary.search('');
            expect(results).toEqual([]);
        });

        test('returns empty array for whitespace query', () => {
            const results = tablerLibrary.search('   ');
            expect(results).toEqual([]);
        });
    });
});
