// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const es = require('!!file?name=i18n/[name].[ext]!./es.json');
const fr = require('!!file?name=i18n/[name].[ext]!./fr.json');
const pt = require('!!file?name=i18n/[name].[ext]!./pt.json');

import {addLocaleData} from 'react-intl';
import enLocaleData from 'react-intl/locale-data/en';
import esLocaleData from 'react-intl/locale-data/es';
import frLocaleData from 'react-intl/locale-data/fr';
import ptLocaleData from 'react-intl/locale-data/pt';

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
    fr: {
        value: 'fr',
        name: 'Français (Beta)',
        url: fr
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

export function safariFix(callback) {
    require.ensure([
        'intl',
        'intl/locale-data/jsonp/en.js',
        'intl/locale-data/jsonp/es.js',
        'intl/locale-data/jsonp/fr.js',
        'intl/locale-data/jsonp/pt.js'
    ], (require) => {
        require('intl');
        require('intl/locale-data/jsonp/en.js');
        require('intl/locale-data/jsonp/es.js');
        require('intl/locale-data/jsonp/fr.js');
        require('intl/locale-data/jsonp/pt.js');
        callback();
    });
}

export function doAddLocaleData() {
    addLocaleData(enLocaleData);
    addLocaleData(esLocaleData);
    addLocaleData(frLocaleData);
    addLocaleData(ptLocaleData);
}
