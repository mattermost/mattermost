// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useMemo} from 'react';
import type {ReactNode} from 'react';
import {RawIntlProvider, createIntl, createIntlCache} from 'react-intl';
import type {IntlConfig, IntlShape} from 'react-intl';

import {Client4} from 'mattermost-redux/client';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import {setLocalizeFunction} from 'mattermost-redux/utils/i18n_utils';

import * as I18n from 'i18n/i18n';
import {localizeMessage} from 'utils/utils';

type Props = {
    children: ReactNode;
    locale: IntlConfig['locale'];
    translations?: IntlConfig['messages'];
    actions: {
        loadTranslations: ((locale: string, url: string) => ActionFunc) | (() => void);
    };
};

const intlCache = createIntlCache();

export let GLOBAL_INTL: IntlShape | undefined;
let LAST_MSG_REF: IntlConfig['messages'];

export const makeIntl = (locale: IntlConfig['locale'], messages: IntlConfig['messages']) => {
    if (locale === GLOBAL_INTL?.locale && messages === LAST_MSG_REF) {
        return GLOBAL_INTL;
    }
    GLOBAL_INTL = (messages && createIntl({locale, messages, textComponent: 'span', wrapRichTextChunksInFragment: false}, intlCache)) || undefined;
    if (GLOBAL_INTL) {
        LAST_MSG_REF = messages;
    }

    return GLOBAL_INTL;
};

function IntlProvider({locale, translations, children, actions}: Props) {
    useEffect(() => {
        // Pass localization function back to mattermost-redux
        setLocalizeFunction(localizeMessage);
    }, [localizeMessage]);

    useEffect(() => {
        Client4.setAcceptLanguage(locale);

        if (translations) {
            // Already loaded
            return;
        }
        const localeInfo = I18n.getLanguageInfo(locale);

        if (!localeInfo) {
            return;
        }

        actions.loadTranslations(locale, localeInfo.url);
    }, [locale]);

    const intl = useMemo(() => makeIntl(locale, translations), [translations]);

    if (!intl) {
        return null;
    }

    return (
        <RawIntlProvider
            key={locale}
            value={intl}
        >
            {children}
        </RawIntlProvider>
    );
}

export default memo(IntlProvider);
