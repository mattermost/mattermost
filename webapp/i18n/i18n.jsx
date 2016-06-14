// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const de = require('!!file?name=i18n/[name].[ext]!./de.json');
const es = require('!!file?name=i18n/[name].[ext]!./es.json');
const fr = require('!!file?name=i18n/[name].[ext]!./fr.json');
const ja = require('!!file?name=i18n/[name].[ext]!./ja.json');
const pt_BR = require('!!file?name=i18n/[name].[ext]!./pt-BR.json'); //eslint-disable-line camelcase

import {addLocaleData} from 'react-intl';
import deLocaleData from 'react-intl/locale-data/de';
import enLocaleData from 'react-intl/locale-data/en';
import esLocaleData from 'react-intl/locale-data/es';
import frLocaleData from 'react-intl/locale-data/fr';
import jaLocaleData from 'react-intl/locale-data/ja';
import ptLocaleData from 'react-intl/locale-data/pt';

// should match the values in model/config.go
const languages = {
    de: {
        value: 'de',
        name: 'Deutsche (Beta)',
        url: de
    },
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
    fr: {
        value: 'fr',
        name: 'Français (Beta)',
        url: fr
    },
    ja: {
        value: 'ja',
        name: '日本語 (Beta)',
        url: ja
    },
    'pt-BR': {
        value: 'pt-BR',
        name: 'Portugues (Beta)',
        url: pt_BR
    }
};

let availableLanguages = null;

function setAvailableLanguages() {
    let available;
    availableLanguages = {};

    if (global.window.mm_config.AvailableLocales) {
        available = global.window.mm_config.AvailableLocales.split(',');
    } else {
        available = Object.keys(languages);
    }

    available.forEach((l) => {
        if (languages[l]) {
            availableLanguages[l] = languages[l];
        }
    });
}

export function getAllLanguages() {
    return languages;
}

export function getLanguages() {
    if (!availableLanguages) {
        setAvailableLanguages();
    }
    return availableLanguages;
}

export function getLanguageInfo(locale) {
    if (!availableLanguages) {
        setAvailableLanguages();
    }
    return availableLanguages[locale];
}

export function isLanguageAvailable(locale) {
    return !!availableLanguages[locale];
}

export function safariFix(callback) {
    require.ensure([
        'intl',
        'intl/locale-data/jsonp/de.js',
        'intl/locale-data/jsonp/en.js',
        'intl/locale-data/jsonp/es.js',
        'intl/locale-data/jsonp/fr.js',
        'intl/locale-data/jsonp/ja.js',
        'intl/locale-data/jsonp/pt.js'
    ], (require) => {
        require('intl');
        require('intl/locale-data/jsonp/de.js');
        require('intl/locale-data/jsonp/en.js');
        require('intl/locale-data/jsonp/es.js');
        require('intl/locale-data/jsonp/fr.js');
        require('intl/locale-data/jsonp/ja.js');
        require('intl/locale-data/jsonp/pt.js');
        callback();
    });
}

export function doAddLocaleData() {
    addLocaleData(enLocaleData);
    addLocaleData(deLocaleData);
    addLocaleData(esLocaleData);
    addLocaleData(frLocaleData);
    addLocaleData(jaLocaleData);
    addLocaleData(ptLocaleData);
}
