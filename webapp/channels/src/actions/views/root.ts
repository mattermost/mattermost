// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {getClientConfig, getLicenseConfig} from 'mattermost-redux/actions/general';
import {loadMe, loadMeREST} from 'mattermost-redux/actions/users';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import {GlobalState} from 'types/store';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import {Translations} from 'types/store/i18n';
import {ActionTypes} from 'utils/constants';
import en from 'i18n/en.json';

const pluginTranslationSources: Record<string, TranslationPluginFunction> = {};

export type TranslationPluginFunction = (locale: string) => Translations

export function loadConfigAndMe() {
    return async (dispatch: DispatchFunc) => {
        const [{data: clientConfig}] = await Promise.all([
            dispatch(getClientConfig()),
            dispatch(getLicenseConfig()),
        ]);

        const isGraphQLEnabled = clientConfig && clientConfig.FeatureFlagGraphQL === 'true';

        let isMeLoaded = false;
        if (document.cookie.includes('MMUSERID=')) {
            if (isGraphQLEnabled) {
                const dataFromLoadMe = await dispatch(loadMe());
                isMeLoaded = dataFromLoadMe?.data ?? false;
            } else {
                const dataFromLoadMeREST = await dispatch(loadMeREST());
                isMeLoaded = dataFromLoadMeREST?.data ?? false;
            }
        }

        return {data: isMeLoaded};
    };
}

export function registerPluginTranslationsSource(pluginId: string, sourceFunction: TranslationPluginFunction) {
    pluginTranslationSources[pluginId] = sourceFunction;
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
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

export function loadTranslations(locale: string, url: string) {
    return async (dispatch: DispatchFunc) => {
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

export function registerCustomPostRenderer(type: string, component: any, id: string) {
    return async (dispatch: DispatchFunc) => {
        // piggyback on plugins state to register a custom post renderer
        dispatch({
            type: ActionTypes.RECEIVED_PLUGIN_POST_COMPONENT,
            data: {
                postTypeId: id,
                pluginId: id,
                type,
                component,
            },
        });
        return {data: true};
    };
}
