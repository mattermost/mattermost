// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function isValidPluginConfiguration(pluginConfiguration: unknown) {
    if (!pluginConfiguration) {
        return false;
    }

    if (typeof pluginConfiguration !== 'object') {
        return false;
    }

    if (!('id' in pluginConfiguration) || !pluginConfiguration.id || typeof pluginConfiguration.id !== 'string') {
        return false;
    }

    if ('icon' in pluginConfiguration && pluginConfiguration.icon && typeof pluginConfiguration.icon !== 'string') {
        return false;
    }

    if (!('settings' in pluginConfiguration) || !Array.isArray(pluginConfiguration.settings)) {
        return false;
    }

    if (!pluginConfiguration.settings.length) {
        return false;
    }

    for (const setting of pluginConfiguration.settings) {
        const isValid = isValidPluginConfigurationSetting(setting);
        if (!isValid) {
            return false;
        }
    }

    return true;
}

function isValidPluginConfigurationSetting(setting: unknown) {
    if (!setting || typeof setting !== 'object') {
        return false;
    }

    if (!('name' in setting) || !setting.name || typeof setting.name !== 'string') {
        return false;
    }

    if (!('title' in setting) || !setting.title || typeof setting.title !== 'string') {
        return false;
    }

    if ('helpText' in setting && typeof setting.helpText !== 'string') {
        return false;
    }

    if ('onSubmit' in setting && typeof setting.onSubmit !== 'function') {
        return false;
    }

    if ('default' in setting && typeof setting.default !== 'string') {
        return false;
    }

    if (!('type' in setting) || !setting.type || typeof setting.type !== 'string') {
        return false;
    }

    switch (setting.type) {
    case 'radio':
        return isValidPluginConfigurationRadioSetting(setting);
    default:
        return false;
    }
}

function isValidPluginConfigurationRadioSetting(setting: unknown) {
    if (!setting || typeof setting !== 'object') {
        return false;
    }

    if (!('options' in setting) || !Array.isArray(setting.options)) {
        return false;
    }

    for (const option of setting.options) {
        const isValid = isValidRadioOption(option);
        if (!isValid) {
            return false;
        }
    }

    return true;
}

function isValidRadioOption(option: unknown) {
    if (!option || typeof option !== 'object') {
        return false;
    }

    if (!('value' in option) || !option.value || typeof option.value !== 'string') {
        return false;
    }

    if (!('text' in option) || !option.text || typeof option.text !== 'string') {
        return false;
    }

    if (('helpText' in option) && typeof option.helpText !== 'string') {
        return false;
    }

    return true;
}
