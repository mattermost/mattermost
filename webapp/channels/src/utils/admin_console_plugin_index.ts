// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape, MessageDescriptor} from 'react-intl';

import type {PluginRedux, PluginSetting} from '@mattermost/types/plugins';

import getEnablePluginSetting from 'components/admin_console/custom_plugin_settings/enable_plugin_setting';
import type {AdminDefinitionSetting} from 'components/admin_console/types';

import {stripMarkdown} from 'utils/markdown';

function extractTextsFromPlugin(plugin: PluginRedux, intl: IntlShape) {
    const texts = extractTextFromSetting(getEnablePluginSetting(plugin), intl);
    if (plugin.name) {
        texts.push(plugin.name);
    }
    if (plugin.id) {
        texts.push(plugin.id);
    }
    if (plugin.settings_schema) {
        if (plugin.settings_schema.footer) {
            texts.push(stripMarkdown(plugin.settings_schema.footer));
        }
        if (plugin.settings_schema.header) {
            texts.push(stripMarkdown(plugin.settings_schema.header));
        }

        if (plugin.settings_schema.settings) {
            const settings = Object.values(plugin.settings_schema.settings);

            for (const setting of settings) {
                const settingsTexts = extractTextFromSetting(setting as Partial<AdminDefinitionSetting & PluginSetting>, intl);
                texts.push(...settingsTexts);
            }
        }
    }
    return texts;
}

function pushString(texts: string[], value: string | MessageDescriptor | undefined, intl: IntlShape, shouldStripMarkdown?: boolean) {
    let newValue;
    if (value) {
        if (typeof value === 'string') {
            newValue = value;
        } else {
            newValue = intl.formatMessage(value);
        }
    }

    if (newValue && shouldStripMarkdown) {
        newValue = stripMarkdown(newValue);
    }

    if (newValue) {
        texts.push(newValue);
    }
}

function extractTextFromSetting(setting: Partial<AdminDefinitionSetting & PluginSetting>, intl: IntlShape) {
    const texts: string[] = [];
    pushString(texts, setting.label, intl);
    pushString(texts, setting.display_name, intl);
    pushString(texts, setting.help_text, intl, true);
    pushString(texts, setting.key, intl);
    return texts;
}

export function getPluginEntries(pluginsObj: Record<string, PluginRedux> | undefined, intl: IntlShape) {
    const entries: Record<string, string[]> = {};
    const plugins = pluginsObj || {};
    for (const pluginId of Object.keys(plugins)) {
        const url = `plugin_${pluginId}`;
        entries[url] = extractTextsFromPlugin(plugins[pluginId], intl);
    }
    return entries;
}
