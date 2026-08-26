// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import {getAllLanguages, getLanguageInfo, getLanguages, isLanguageAvailable, languages} from './i18n';

describe('i18n', () => {
    test('getAllLanguages', () => {
        expect(getAllLanguages()).toBe(languages);
    });

    test('getLanguages', () => {
        const state = {
            entities: {
                general: {
                    config: {
                    },
                },
            },
        } as GlobalState;

        expect(getLanguages(state)).toBe(languages);
    });

    test('getLanguages honours AvailableLocales', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        AvailableLocales: 'de,fr',
                    },
                },
            },
        } as GlobalState;

        expect(Object.keys(getLanguages(state))).toEqual(['de', 'fr']);
    });

    test('getLanguages ignores unsupported codes in AvailableLocales', () => {
        const state = {
            entities: {
                general: {
                    config: {
                        AvailableLocales: 'de,cs',
                    },
                },
            },
        } as GlobalState;

        expect(Object.keys(getLanguages(state))).toEqual(['de']);
    });

    test('getLanguageInfo', () => {
        expect(getLanguageInfo('en')).toStrictEqual({
            name: 'English (US)',
            order: 1,
            url: '',
            value: 'en',
        });

        // a locale that is not supported
        expect(getLanguageInfo('cs')).not.toBeDefined();
        expect(getLanguageInfo('invalid')).not.toBeDefined();
    });

    test('isLanguageAvailable', () => {
        const state = {
            entities: {
                general: {
                    config: {
                    },
                },
            },
        } as GlobalState;

        expect(isLanguageAvailable(state, 'de')).toBe(true);
        expect(isLanguageAvailable(state, 'cs')).toBe(false);
    });
});
