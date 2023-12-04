// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BasePluginConfigurationSetting, PluginConfiguration, PluginConfigurationRadioSetting, PluginConfigurationRadioSettingOption, PluginConfigurationSection} from 'types/plugins/user_settings';

export function extractPluginConfiguration(pluginConfiguration: unknown) {
    if (!pluginConfiguration) {
        return undefined;
    }

    if (typeof pluginConfiguration !== 'object') {
        return undefined;
    }

    if (!('id' in pluginConfiguration) || !pluginConfiguration.id || typeof pluginConfiguration.id !== 'string') {
        return undefined;
    }

    if (!('uiName' in pluginConfiguration) || !pluginConfiguration.uiName || typeof pluginConfiguration.uiName !== 'string') {
        return undefined;
    }

    let icon;
    if ('icon' in pluginConfiguration && pluginConfiguration.icon) {
        if (typeof pluginConfiguration.icon === 'string') {
            icon = pluginConfiguration.icon;
        } else {
            return undefined;
        }
    }

    if (!('sections' in pluginConfiguration) || !Array.isArray(pluginConfiguration.sections)) {
        return undefined;
    }

    if (!pluginConfiguration.sections.length) {
        return undefined;
    }

    const result: PluginConfiguration = {
        id: pluginConfiguration.id,
        icon,
        sections: [],
        uiName: pluginConfiguration.uiName,
    };

    for (const section of pluginConfiguration.sections) {
        const validSections = extractPluginConfigurationSection(section);
        if (validSections) {
            result.sections.push(validSections);
        }
    }

    if (!result.sections.length) {
        return undefined;
    }

    return result;
}

function extractPluginConfigurationSection(section: unknown) {
    if (!section) {
        return undefined;
    }

    if (typeof section !== 'object') {
        return undefined;
    }

    if (!('title' in section) || !section.title || typeof section.title !== 'string') {
        return undefined;
    }

    if (!('settings' in section) || !Array.isArray(section.settings)) {
        return undefined;
    }

    if (!section.settings.length) {
        return undefined;
    }

    let onSubmit;
    if ('onSubmit' in section && section.onSubmit) {
        if (typeof section.onSubmit === 'function') {
            onSubmit = section.onSubmit as PluginConfigurationSection['onSubmit'];
        } else {
            return undefined;
        }
    }

    const result: PluginConfigurationSection = {
        settings: [],
        title: section.title,
        onSubmit,
    };

    for (const setting of section.settings) {
        const validSetting = extractPluginConfigurationSetting(setting);
        if (validSetting) {
            result.settings.push(validSetting);
        }
    }

    if (!result.settings.length) {
        return undefined;
    }

    return result;
}

function extractPluginConfigurationSetting(setting: unknown) {
    if (!setting || typeof setting !== 'object') {
        return undefined;
    }

    if (!('name' in setting) || !setting.name || typeof setting.name !== 'string') {
        return undefined;
    }

    let title;
    if (('title' in setting) && setting.title) {
        if (typeof setting.title === 'string') {
            title = setting.title;
        } else {
            return undefined;
        }
    }

    let helpText;
    if ('helpText' in setting && setting.helpText) {
        if (typeof setting.helpText === 'string') {
            helpText = setting.helpText;
        } else {
            return undefined;
        }
    }

    let defaultValue;
    if ('default' in setting && setting.default) {
        if (typeof setting.default === 'string') {
            defaultValue = setting.default;
        } else {
            return undefined;
        }
    }

    if (!('type' in setting) || !setting.type || typeof setting.type !== 'string') {
        return undefined;
    }

    const res: BasePluginConfigurationSetting = {
        default: defaultValue,
        name: setting.name,
        title,
        helpText,
    };

    switch (setting.type) {
    case 'radio':
        return extractPluginConfigurationRadioSetting(setting, res);
    default:
        return undefined;
    }
}

function extractPluginConfigurationRadioSetting(setting: unknown, base: BasePluginConfigurationSetting) {
    if (!setting || typeof setting !== 'object') {
        return undefined;
    }

    if (!('default' in setting) || !setting.default || typeof setting.default !== 'string') {
        return undefined;
    }

    if (!('options' in setting) || !Array.isArray(setting.options)) {
        return undefined;
    }

    const res: PluginConfigurationRadioSetting = {
        ...base,
        type: 'radio',
        default: setting.default,
        options: [],
    };

    for (const option of setting.options) {
        const isValid = extractValidRadioOption(option);
        if (isValid) {
            res.options.push(isValid);
        }
    }

    if (!res.options.length) {
        return undefined;
    }

    return res;
}

function extractValidRadioOption(option: unknown) {
    if (!option || typeof option !== 'object') {
        return undefined;
    }

    if (!('value' in option) || !option.value || typeof option.value !== 'string') {
        return undefined;
    }

    if (!('text' in option) || !option.text || typeof option.text !== 'string') {
        return undefined;
    }

    let helpText;
    if ('helpText' in option && option.helpText) {
        if (typeof option.helpText === 'string') {
            helpText = option.helpText;
        } else {
            return undefined;
        }
    }

    const res: PluginConfigurationRadioSettingOption = {
        value: option.value,
        text: option.text,
        helpText,
    };

    return res;
}
