// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import FlexSearch from 'flexsearch/dist/flexsearch.es5';
import {IntlShape} from 'react-intl';

import {PluginRedux} from '@mattermost/types/plugins';

import AdminDefinition from 'components/admin_console/admin_definition';

import {getPluginEntries} from './admin_console_plugin_index';

export type Index = {

    /**
     * Adds an element to the index.
     *
     * @param id if of element to be added
     * @param element string to be added
     */
    add(id: string, element: string): void;

    /**
     * Searches for a list of elements matching the query.
     *
     * @param query string to be used for search.
     */
    search(query: string): string[];
}

function extractTextsFromSection(section: Record<string, any>, intl: IntlShape) {
    const texts: Array<string | string[]> = [];
    if (section.title) {
        texts.push(intl.formatMessage({id: section.title, defaultMessage: section.title_default}));
    }
    if (section.schema && section.schema.name) {
        texts.push(section.schema.name);
    }
    if (section.searchableStrings) {
        for (const searchableString of section.searchableStrings) {
            if (typeof searchableString === 'string') {
                texts.push(intl.formatMessage({id: searchableString, defaultMessage: searchableString}));
            } else {
                texts.push(intl.formatMessage({id: searchableString[0], defaultMessage: ''}, searchableString[1]));
            }
        }
    }

    if (section.schema) {
        if (section.schema.settings) {
            texts.push(extractTextFromSettings(section.schema.settings, intl));
        } else if (section.schema.sections) {
            section.schema.sections.forEach((schemaSection: any) => {
                texts.push(...extractTextFromSettings(schemaSection.settings, intl));
            });
        }
    }

    return texts;
}

function extractTextFromSettings(settings: Array<Record<string, any>>, intl: IntlShape) {
    const texts = [];

    for (const setting of Object.values(settings)) {
        if (setting.label) {
            texts.push(intl.formatMessage({id: setting.label, defaultMessage: setting.label_default}, setting.label_values));
        }
        if (setting.help_text && typeof setting.help_text === 'string') {
            texts.push(intl.formatMessage({id: setting.help_text, defaultMessage: setting.help_text_default}, setting.help_text_values));
        }
        if (setting.remove_help_text) {
            texts.push(intl.formatMessage({id: setting.remove_help_text, defaultMessage: setting.remove_help_text_default}));
        }
        if (setting.remove_button_text) {
            texts.push(intl.formatMessage({id: setting.remove_button_text, defaultMessage: setting.remove_button_text_default}));
        }
    }

    return texts;
}

export function adminDefinitionsToUrlsAndTexts(adminDefinition: typeof AdminDefinition, intl: IntlShape) {
    const entries: Record<string, Array<string | string[]>> = {};
    const sections = [
        adminDefinition.about,
        adminDefinition.reporting,
        adminDefinition.user_management,
        adminDefinition.environment,
        adminDefinition.site,
        adminDefinition.authentication,
        adminDefinition.plugins,
        adminDefinition.integrations,
        adminDefinition.compliance,
        adminDefinition.experimental,
        adminDefinition.products,
        adminDefinition.billing,
    ];
    for (const section of sections) {
        for (const item of Object.values(section)) {
            if (!item.isDiscovery) {
                entries[item.url] = extractTextsFromSection(item, intl);
            }
        }
    }
    return entries;
}

export function generateIndex(adminDefinition: typeof AdminDefinition, intl: IntlShape, plugins?: Record<string, PluginRedux>) {
    const idx: Index = new FlexSearch();

    addToIndex(adminDefinitionsToUrlsAndTexts(adminDefinition, intl), idx);

    addToIndex(getPluginEntries(plugins), idx);

    return idx;
}

function addToIndex(entries: Record<string, Array<string | string[]>>, idx: Index) {
    for (const key of Object.keys(entries)) {
        let text = '';
        for (const str of entries[key]) {
            text += ' ' + str;
        }
        idx.add(key, text);
    }
}

