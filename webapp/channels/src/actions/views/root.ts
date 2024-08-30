// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync, ThunkActionFunc} from 'mattermost-redux/types/actions';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';

import en from 'i18n/en.json';
import {ActionTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {Translations} from 'types/store/i18n';

const pluginTranslationSources: Record<string, TranslationPluginFunction> = {};

export type TranslationPluginFunction = (locale: string) => Translations

export function registerPluginTranslationsSource(pluginId: string, sourceFunction: TranslationPluginFunction): ThunkActionFunc<void, GlobalState> {
    pluginTranslationSources[pluginId] = sourceFunction;
    return (dispatch, getState) => {
        const state = getState();
        const locale = getCurrentLocale(state);
        const immutableTranslations = getTranslations(state, locale);
        const translations = {};
        Object.assign(translations, immutableTranslations);
        if (immutableTranslations) {
            Object.assign(translations, sourceFunction(locale));
            dispatch({
                type: ActionTypes.RECEIVED_TRANSLATIONS,
                data: {
                    locale,
                    translations,
                },
            });
        }
    };
}

export function unregisterPluginTranslationsSource(pluginId: string) {
    Reflect.deleteProperty(pluginTranslationSources, pluginId);
}

export function loadTranslations(locale: string, url: string): ActionFuncAsync {
    return async (dispatch) => {
        const translations = {...en};
        Object.values(pluginTranslationSources).forEach((pluginFunc) => {
            Object.assign(translations, pluginFunc(locale));
        });

        // Need to go to the server for languages other than English
        if (locale !== 'en') {
            try {
                const serverTranslations = await Client4.getTranslations(url);
                Object.assign(translations, serverTranslations);
            } catch (error) {
                console.error(error); //eslint-disable-line no-console
            }
        }
        dispatch({
            type: ActionTypes.RECEIVED_TRANSLATIONS,
            data: {
                locale,
                translations,
            },
        });
        return {data: true};
    };
}
