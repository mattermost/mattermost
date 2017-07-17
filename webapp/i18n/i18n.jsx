// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const de = require('!!file-loader?name=i18n/[name].[hash].[ext]!./de.json');
const es = require('!!file-loader?name=i18n/[name].[hash].[ext]!./es.json');
const fr = require('!!file-loader?name=i18n/[name].[hash].[ext]!./fr.json');
const it = require('!!file-loader?name=i18n/[name].[hash].[ext]!./it.json');
const ja = require('!!file-loader?name=i18n/[name].[hash].[ext]!./ja.json');
const ko = require('!!file-loader?name=i18n/[name].[hash].[ext]!./ko.json');
const nl = require('!!file-loader?name=i18n/[name].[hash].[ext]!./nl.json');
const pl = require('!!file-loader?name=i18n/[name].[hash].[ext]!./pl.json');
const pt_BR = require('!!file-loader?name=i18n/[name].[hash].[ext]!./pt-BR.json'); //eslint-disable-line camelcase
const tr = require('!!file-loader?name=i18n/[name].[hash].[ext]!./tr.json');
const ru = require('!!file-loader?name=i18n/[name].[hash].[ext]!./ru.json');
const zh_TW = require('!!file-loader?name=i18n/[name].[hash].[ext]!./zh-TW.json'); //eslint-disable-line camelcase
const zh_CN = require('!!file-loader?name=i18n/[name].[hash].[ext]!./zh-CN.json'); //eslint-disable-line camelcase

import {addLocaleData} from 'react-intl';
import deLocaleData from 'react-intl/locale-data/de';
import enLocaleData from 'react-intl/locale-data/en';
import esLocaleData from 'react-intl/locale-data/es';
import frLocaleData from 'react-intl/locale-data/fr';
import itLocaleData from 'react-intl/locale-data/it';
import jaLocaleData from 'react-intl/locale-data/ja';
import koLocaleData from 'react-intl/locale-data/ko';
import nlLocaleData from 'react-intl/locale-data/nl';
import plLocaleData from 'react-intl/locale-data/pl';
import ptLocaleData from 'react-intl/locale-data/pt';
import trLocaleData from 'react-intl/locale-data/tr';
import ruLocaleData from 'react-intl/locale-data/ru';
import zhLocaleData from 'react-intl/locale-data/zh';

// should match the values in model/config.go
const languages = {
    de: {
        value: 'de',
        name: 'Deutsch',
        order: 0,
        url: de
    },
    en: {
        value: 'en',
        name: 'English',
        order: 1,
        url: ''
    },
    es: {
        value: 'es',
        name: 'Español',
        order: 2,
        url: es
    },
    fr: {
        value: 'fr',
        name: 'Français',
        order: 3,
        url: fr
    },
    it: {
        value: 'it',
        name: 'Italiano (Beta)',
        order: 4,
        url: it
    },
    ja: {
        value: 'ja',
        name: '日本語',
        order: 13,
        url: ja
    },
    ko: {
        value: 'ko',
        name: '한국어 (Alpha)',
        order: 10,
        url: ko
    },
    nl: {
        value: 'nl',
        name: 'Nederlands (Alpha)',
        order: 5,
        url: nl
    },
    pl: {
        value: 'pl',
        name: 'Polski (Beta)',
        order: 6,
        url: pl
    },
    'pt-BR': {
        value: 'pt-BR',
        name: 'Português (Brasil)',
        order: 7,
        url: pt_BR
    },
    tr: {
        value: 'tr',
        name: 'Türkçe (Beta)',
        order: 8,
        url: tr
    },
    ru: {
        value: 'ru',
        name: 'Pусский (Beta)',
        order: 9,
        url: ru
    },
    'zh-TW': {
        value: 'zh-TW',
        name: '中文 (繁體)',
        order: 12,
        url: zh_TW
    },
    'zh-CN': {
        value: 'zh-CN',
        name: '中文 (简体)',
        order: 11,
        url: zh_CN
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
    return getAllLanguages()[locale];
}

export function isLanguageAvailable(locale) {
    return Boolean(getLanguages()[locale]);
}

export function safariFix(callback) {
    require.ensure([
        'intl',
        'intl/locale-data/jsonp/de.js',
        'intl/locale-data/jsonp/en.js',
        'intl/locale-data/jsonp/es.js',
        'intl/locale-data/jsonp/fr.js',
        'intl/locale-data/jsonp/it.js',
        'intl/locale-data/jsonp/ja.js',
        'intl/locale-data/jsonp/ko.js',
        'intl/locale-data/jsonp/nl.js',
        'intl/locale-data/jsonp/pl.js',
        'intl/locale-data/jsonp/pt.js',
        'intl/locale-data/jsonp/tr.js',
        'intl/locale-data/jsonp/ru.js',
        'intl/locale-data/jsonp/zh.js'
    ], (require) => {
        require('intl');
        require('intl/locale-data/jsonp/de.js');
        require('intl/locale-data/jsonp/en.js');
        require('intl/locale-data/jsonp/es.js');
        require('intl/locale-data/jsonp/fr.js');
        require('intl/locale-data/jsonp/it.js');
        require('intl/locale-data/jsonp/ja.js');
        require('intl/locale-data/jsonp/ko.js');
        require('intl/locale-data/jsonp/nl.js');
        require('intl/locale-data/jsonp/pl.js');
        require('intl/locale-data/jsonp/pt.js');
        require('intl/locale-data/jsonp/tr.js');
        require('intl/locale-data/jsonp/ru.js');
        require('intl/locale-data/jsonp/zh.js');
        callback();
    });
}

export function doAddLocaleData() {
    addLocaleData(enLocaleData);
    addLocaleData(deLocaleData);
    addLocaleData(esLocaleData);
    addLocaleData(frLocaleData);
    addLocaleData(itLocaleData);
    addLocaleData(jaLocaleData);
    addLocaleData(koLocaleData);
    addLocaleData(nlLocaleData);
    addLocaleData(plLocaleData);
    addLocaleData(ptLocaleData);
    addLocaleData(trLocaleData);
    addLocaleData(ruLocaleData);
    addLocaleData(zhLocaleData);
}
