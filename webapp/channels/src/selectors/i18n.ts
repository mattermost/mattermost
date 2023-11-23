// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserLocale} from 'mattermost-redux/selectors/entities/i18n';

import * as I18n from 'i18n/i18n';

import type {GlobalState} from 'types/store';
import type {Translations} from 'types/store/i18n';

// This is a placeholder for if we ever implement browser-locale detection
export function getCurrentLocale(state: GlobalState): string {
    // If locale is provided in query parameter and the user is not logged in, we try get locale from param
    const localeFromParam: string | null = (new URLSearchParams(window.location?.search)).get('locale');
    const defaultLocale: string | undefined =
        localeFromParam && I18n.isLanguageAvailable(localeFromParam) ? localeFromParam : getConfig(state).DefaultClientLocale;

    const currentLocale: string = getCurrentUserLocale(state, defaultLocale);
    if (I18n.isLanguageAvailable(currentLocale)) {
        return currentLocale;
    }
    return General.DEFAULT_LOCALE;
}

export function getTranslations(state: GlobalState, locale: string): Translations {
    const localeInfo = I18n.getLanguageInfo(locale);

    let translations;
    if (localeInfo) {
        translations = state.views.i18n.translations[locale];
    } else {
        // Default to English if an unsupported locale is specified
        translations = state.views.i18n.translations.en;
    }

    return translations;
}
