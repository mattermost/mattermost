// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import messages_ca from 'i18n/ca.json'
import messages_de from 'i18n/de.json'
import messages_el from 'i18n/el.json'
import messages_en from 'i18n/en.json'
import messages_es from 'i18n/es.json'
import messages_fr from 'i18n/fr.json'
import messages_id from 'i18n/id.json'
import messages_it from 'i18n/it.json'
import messages_ja from 'i18n/ja.json'
import messages_nl from 'i18n/nl.json'
import messages_oc from 'i18n/oc.json'
import messages_ptBr from 'i18n/pt_BR.json'
import messages_ru from 'i18n/ru.json'
import messages_sv from 'i18n/sv.json'
import messages_tr from 'i18n/tr.json'
import messages_zhHans from 'i18n/zh_Hans.json'
import messages_zhHant from 'i18n/zh_Hant.json'

import {UserSettings} from './userSettings'

const supportedLanguages = ['ca', 'de', 'el', 'en', 'es', 'fr', 'id', 'it', 'ja', 'nl', 'oc', 'pt-br', 'ru', 'sv', 'tr', 'zh-cn', 'zh-tw']

export function getMessages(lang: string): {[key: string]: string} {
    switch (lang) {
    case 'ca':
        return messages_ca
    case 'de':
        return messages_de
    case 'el':
        return messages_el
    case 'es':
        return messages_es
    case 'fr':
        return messages_fr
    case 'id':
        return messages_id
    case 'it':
        return messages_it
    case 'ja':
        return messages_ja
    case 'nl':
        return messages_nl
    case 'oc':
        return messages_oc
    case 'pt-br':
        return messages_ptBr
    case 'ru':
        return messages_ru
    case 'sv':
        return messages_sv
    case 'tr':
        return messages_tr
    case 'zh-cn':
        return messages_zhHant
    case 'zh-tx':
        return messages_zhHans
    case 'zh-tw':
        return messages_zhHans
    }
    return messages_en
}
export function getCurrentLanguage(): string {
    let lang = UserSettings.language
    if (!lang) {
        if (supportedLanguages.includes(navigator.language)) {
            lang = navigator.language
        } else if (supportedLanguages.includes(navigator.language.split(/[-_]/)[0])) {
            lang = navigator.language.split(/[-_]/)[0]
        } else {
            lang = 'en'
        }
    }
    return lang
}

export function storeLanguage(lang: string): void {
    UserSettings.language = lang
}
