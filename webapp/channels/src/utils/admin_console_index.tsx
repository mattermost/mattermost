// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import FlexSearch from 'flexsearch/dist/flexsearch.es5';
import type {IntlShape, MessageDescriptor} from 'react-intl';

import type {PluginRedux} from '@mattermost/types/plugins';

import type AdminDefinition from 'components/admin_console/admin_definition';
import type {AdminDefinitionSetting, AdminDefinitionSubSection} from 'components/admin_console/types';

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

function pushText(texts: string[], value: string | MessageDescriptor | JSX.Element, intl: IntlShape, values?: Record<string, any>) {
    if (typeof value === 'string') {
        texts.push(value);
    } else if ('id' in value) {
        texts.push(intl.formatMessage(value, values));
    }
}

function extractTextsFromSection(section: AdminDefinitionSubSection, intl: IntlShape) {
    const texts: string[] = [];
    if (section.title) {
        pushText(texts, section.title, intl);
    }
    if ('name' in section.schema && section.schema.name) {
        pushText(texts, section.schema.name, intl);
    }
    if (section.searchableStrings) {
        for (const searchableString of section.searchableStrings) {
            if (Array.isArray(searchableString)) {
                texts.push(intl.formatMessage(searchableString[0], searchableString[1]));
            } else {
                pushText(texts, searchableString, intl);
            }
        }
    }

    if (section.schema) {
        if ('settings' in section.schema && section.schema.settings) {
            texts.push(...extractTextFromSettings(section.schema.settings, intl));
        } else if ('sections' in section.schema && section.schema.sections) {
            section.schema.sections.forEach((schemaSection) => {
                texts.push(...extractTextFromSettings(schemaSection.settings, intl));
            });
        }
    }

    return texts;
}

function extractTextFromSettings(settings: AdminDefinitionSetting[], intl: IntlShape) {
    const texts: string[] = [];

    for (const setting of Object.values(settings)) {
        if (setting.label) {
            pushText(texts, setting.label, intl, setting.label_values);
        }
        if (setting.help_text) {
            pushText(texts, setting.help_text, intl, setting.help_text_values);
        }
        if ('remove_help_text' in setting && setting.remove_help_text) {
            pushText(texts, setting.remove_help_text, intl);
        }
        if ('remove_button_text' in setting && setting.remove_button_text) {
            pushText(texts, setting.remove_button_text, intl);
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
        adminDefinition.billing,
    ];
    for (const section of sections) {
        for (const item of Object.values(section.subsections)) {
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

    addToIndex(getPluginEntries(plugins, intl), idx);

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

