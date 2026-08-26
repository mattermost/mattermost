// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @typedef {} Language
 */

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import {langFiles} from './imports';

export interface Language {
    value: string;
    name: string;
    order: number;
    url: string;
}

// should match the values in server/public/shared/i18n/i18n.go
export const languages = {
    de: {
        value: 'de',
        name: 'Deutsch',
        order: 0,
        url: langFiles.de,
    },
    en: {
        value: 'en',
        name: 'English (US)',
        order: 1,
        url: '',
    },
    'en-AU': {
        value: 'en-AU',
        name: 'English (Australia)',
        order: 2,
        url: langFiles['en-AU'],
    },
    es: {
        value: 'es',
        name: 'Español',
        order: 3,
        url: langFiles.es,
    },
    fr: {
        value: 'fr',
        name: 'Français',
        order: 4,
        url: langFiles.fr,
    },
    it: {
        value: 'it',
        name: 'Italiano',
        order: 5,
        url: langFiles.it,
    },
    hu: {
        value: 'hu',
        name: 'Magyar',
        order: 6,
        url: langFiles.hu,
    },
    nl: {
        value: 'nl',
        name: 'Nederlands',
        order: 7,
        url: langFiles.nl,
    },
    pl: {
        value: 'pl',
        name: 'Polski',
        order: 8,
        url: langFiles.pl,
    },
    'pt-BR': {
        value: 'pt-BR',
        name: 'Português (Brasil)',
        order: 9,
        url: langFiles['pt-BR'],
    },
    ro: {
        value: 'ro',
        name: 'Română',
        order: 10,
        url: langFiles.ro,
    },
    sv: {
        value: 'sv',
        name: 'Svenska',
        order: 11,
        url: langFiles.sv,
    },
    vi: {
        value: 'vi',
        name: 'Tiếng Việt',
        order: 12,
        url: langFiles.vi,
    },
    tr: {
        value: 'tr',
        name: 'Türkçe',
        order: 13,
        url: langFiles.tr,
    },
    bg: {
        value: 'bg',
        name: 'Български',
        order: 14,
        url: langFiles.bg,
    },
    ru: {
        value: 'ru',
        name: 'Pусский',
        order: 15,
        url: langFiles.ru,
    },
    uk: {
        value: 'uk',
        name: 'Yкраїнська',
        order: 16,
        url: langFiles.uk,
    },
    fa: {
        value: 'fa',
        name: 'فارسی',
        order: 17,
        url: langFiles.fa,
    },
    ko: {
        value: 'ko',
        name: '한국어',
        order: 18,
        url: langFiles.ko,
    },
    'zh-CN': {
        value: 'zh-CN',
        name: '中文 (简体)',
        order: 19,
        url: langFiles['zh-CN'],
    },
    'zh-TW': {
        value: 'zh-TW',
        name: '中文 (繁體)',
        order: 20,
        url: langFiles['zh-TW'],
    },
    ja: {
        value: 'ja',
        name: '日本語',
        order: 21,
        url: langFiles.ja,
    },
};

export function getAllLanguages(): Record<string, Language> {
    return languages;
}

export function getLanguages(state: GlobalState) {
    const config = getConfig(state);
    if (!config.AvailableLocales) {
        return getAllLanguages();
    }
    return config.AvailableLocales.split(',').reduce<Record<string, Language>>((result, l) => {
        if (Object.hasOwn(languages, l)) {
            result[l] = languages[l as keyof typeof languages];
        }
        return result;
    }, {});
}

export function getLanguageInfo(locale: string) {
    return languages[locale as keyof typeof languages];
}

export function isLanguageAvailable(state: GlobalState, locale: string) {
    return Boolean(getLanguages(state)[locale]);
}
