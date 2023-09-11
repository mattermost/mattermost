// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {IntlProvider as BaseIntlProvider} from 'react-intl';
import type {IntlConfig} from 'react-intl';

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

export default class IntlProvider extends React.PureComponent<Props> {
    componentDidMount() {
        // Pass localization function back to mattermost-redux
        setLocalizeFunction(localizeMessage);

        this.handleLocaleChange(this.props.locale);
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.locale !== this.props.locale) {
            this.handleLocaleChange(this.props.locale);
        }
    }

    handleLocaleChange = (locale: string) => {
        Client4.setAcceptLanguage(locale);

        this.loadTranslationsIfNecessary(locale);
    };

    loadTranslationsIfNecessary = (locale: string) => {
        if (this.props.translations) {
            // Already loaded
            return;
        }
        const localeInfo = I18n.getLanguageInfo(locale);

        if (!localeInfo) {
            return;
        }

        this.props.actions.loadTranslations(locale, localeInfo.url);
    };

    render() {
        if (!this.props.translations) {
            return null;
        }

        return (
            <BaseIntlProvider
                key={this.props.locale}
                locale={this.props.locale}
                messages={this.props.translations}
                textComponent='span'
                wrapRichTextChunksInFragment={false}
            >
                {this.props.children}
            </BaseIntlProvider>
        );
    }
}
