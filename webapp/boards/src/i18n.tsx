// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import messages_ca from 'i18n/ca.json'
import messages_de from 'i18n/de.json'
import messages_el from 'i18n/el.json'
import messages_en from 'i18n/en.json'
import messages_enAu from 'i18n/en_AU.json'
import messages_es from 'i18n/es.json'
import messages_fa from 'i18n/fa.json'
import messages_fr from 'i18n/fr.json'
import messages_hu from 'i18n/hu.json'
import messages_id from 'i18n/id.json'
import messages_it from 'i18n/it.json'
import messages_ja from 'i18n/ja.json'
import messages_ko from 'i18n/ko.json'
import messages_nl from 'i18n/nl.json'
import messages_oc from 'i18n/oc.json'
import messages_pl from 'i18n/pl.json'
import messages_ptBr from 'i18n/pt_BR.json'
import messages_ru from 'i18n/ru.json'
import messages_sv from 'i18n/sv.json'
import messages_tr from 'i18n/tr.json'
import messages_uk from 'i18n/uk.json'
import messages_zhHans from 'i18n/zh_Hans.json'
import messages_zhHant from 'i18n/zh_Hant.json'

export function getMessages(locale: string): {[key: string]: string} {
    switch (locale) {
    // case 'bg':
    //     return messages_bg // TODO missing translation sourcefile
    case 'ca':
        return messages_ca // TODO missing option in language selector
    case 'de':
        return messages_de
    case 'el':
        return messages_el // TODO missing option in language selector
    case 'en':
    default:
        return messages_en
    case 'en-AU':
        return messages_enAu
    case 'es':
        return messages_es
    case 'fa':
        return messages_fa
    case 'fr':
        return messages_fr
    case 'hu':
        return messages_hu
    case 'id':
        return messages_id // TODO missing option in language selector
    case 'it':
        return messages_it
    case 'ja':
        return messages_ja
    case 'ko':
        return messages_ko
    case 'nl':
        return messages_nl
    case 'oc':
        return messages_oc // TODO missing option in language selector
    case 'pl':
        return messages_pl
    case 'pt-BR':
        return messages_ptBr

    // case 'ro':
    //     return messages_ro // TODO missing translation sourcefile
    case 'ru':
        return messages_ru
    case 'sv':
        return messages_sv
    case 'tr':
        return messages_tr
    case 'uk':
        return messages_uk
    case 'zh-Hans':
    case 'zh-CN':
        return messages_zhHans
    case 'zh-Hant':
    case 'zh-TW':
        return messages_zhHant
    }
}
