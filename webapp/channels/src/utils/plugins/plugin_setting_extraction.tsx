// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BasePluginConfigurationSetting, PluginConfiguration, PluginConfigurationRadioSetting, PluginConfigurationRadioSettingOption} from 'types/plugins/user_settings';

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

    if (!('settings' in pluginConfiguration) || !Array.isArray(pluginConfiguration.settings)) {
        return undefined;
    }

    if (!pluginConfiguration.settings.length) {
        return undefined;
    }

    const result: PluginConfiguration = {
        id: pluginConfiguration.id,
        icon,
        settings: [],
        uiName: pluginConfiguration.uiName,
    };

    for (const setting of pluginConfiguration.settings) {
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

    if (!('title' in setting) || !setting.title || typeof setting.title !== 'string') {
        return undefined;
    }

    let helpText;
    if ('helpText' in setting && setting.helpText) {
        if (typeof setting.helpText === 'string') {
            helpText = setting.helpText;
        } else {
            return undefined;
        }
    }

    let onSubmit;
    if ('onSubmit' in setting && setting.onSubmit) {
        if (typeof setting.onSubmit === 'function') {
            onSubmit = setting.onSubmit as BasePluginConfigurationSetting['onSubmit'];
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
        title: setting.title,
        helpText,
        onSubmit,
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
