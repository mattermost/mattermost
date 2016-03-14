// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const es = require('!!file?name=i18n/[name].[ext]!./es.json');
const pt = require('!!file?name=i18n/[name].[ext]!./pt.json');

const languages = {
    en: {
        value: 'en',
        name: 'English',
        url: ''
    },
    es: {
        value: 'es',
        name: 'Español (Beta)',
        url: es
    },
    pt: {
        value: 'pt',
        name: 'Portugues (Beta)',
        url: pt
    }
};

export function getLanguages() {
    return languages;
}

export function getLanguageInfo(locale) {
    return languages[locale];
}
