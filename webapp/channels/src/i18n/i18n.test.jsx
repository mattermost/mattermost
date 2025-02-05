// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAllLanguages, getLanguageInfo, getLanguages, isLanguageAvailable, languages} from './i18n';

jest.mock('./imports', () => ({
    langIDs: ['cc'],
    langFiles: {cc: 'cc.json'},
    langLabels: {cc: 'CC Language'},
}));

describe('i18n', () => {
    test('getAllLanguages', () => {
        // no experimental languages
        expect(getAllLanguages()).toBe(languages);
        expect(getAllLanguages(false)).toBe(languages);

        // with experimental languages
        expect(getAllLanguages(true)).toStrictEqual({
            cc: {
                name: 'CC Language',
                value: 'cc',
                order: 22,
                url: 'cc.json',
            },
            ...languages,
        });
    });

    test('getLanguages', () => {
        const state = {
            entities: {
                general: {
                    config: {
                    },
                },
            },
        };

        // no experimental languages
        expect(getLanguages(state)).toBe(languages);

        // with experimental languages
        state.entities.general.config.EnableExperimentalLocales = 'true';
        expect(getLanguages(state)).toStrictEqual({
            cc: {
                name: 'CC Language',
                value: 'cc',
                order: 22,
                url: 'cc.json',
            },
            ...languages,
        });
    });

    test('getLanguageInfo', () => {
        // supported language
        expect(getLanguageInfo('en')).toStrictEqual({
            name: 'English (US)',
            order: 1,
            url: '',
            value: 'en',
        });

        // experimental language (e.g. in progress)
        expect(getLanguageInfo('cc')).toStrictEqual({
            name: 'CC Language',
            value: 'cc',
            order: 22,
            url: 'cc.json',
        });

        // non existant
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
        };

        // no experimental languages
        expect(isLanguageAvailable(state, 'cc')).toBe(false);

        // with experimental languages
        state.entities.general.config.EnableExperimentalLocales = 'true';
        expect(isLanguageAvailable(state, 'cc')).toBe(true);
    });
});
