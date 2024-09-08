// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    BasePluginConfigurationSetting,
    PluginConfiguration,
    PluginConfigurationAction,
    PluginConfigurationRadioSetting,
    PluginConfigurationRadioSettingOption,
    PluginConfigurationSection,
    PluginConfigurationCustomSetting,
    PluginCustomSettingComponent,
} from 'types/plugins/user_settings';

export function extractPluginConfiguration(pluginConfiguration: unknown, pluginId: string) {
    if (!pluginConfiguration) {
        return undefined;
    }

    if (typeof pluginConfiguration !== 'object') {
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

    let action;
    if ('action' in pluginConfiguration && pluginConfiguration.action) {
        action = extractPluginConfigurationAction(pluginConfiguration.action);
    }

    const result: PluginConfiguration = {
        id: pluginId,
        icon,
        sections: [],
        uiName: pluginConfiguration.uiName,
        action,
    };

    for (const section of pluginConfiguration.sections) {
        const validSections = extractPluginConfigurationSection(section, pluginId);
        if (validSections) {
            result.sections.push(validSections);
        } else {
            // eslint-disable-next-line no-console
            console.warn(`Plugin ${pluginId} is trying to register an invalid configuration section. Contact the plugin developer to fix this issue.`);
        }
    }

    if (!result.sections.length) {
        return undefined;
    }

    return result;
}

function extractPluginConfigurationAction(action: unknown): PluginConfigurationAction | undefined {
    if (!action) {
        return undefined;
    }

    if (typeof action !== 'object') {
        return undefined;
    }

    if (!('title' in action) || !action.title || typeof action.title !== 'string') {
        return undefined;
    }

    if (!('text' in action) || !action.text || typeof action.text !== 'string') {
        return undefined;
    }

    if (!('buttonText' in action) || !action.buttonText || typeof action.buttonText !== 'string') {
        return undefined;
    }

    if (!('onClick' in action) || !action.onClick || typeof action.onClick !== 'function') {
        return undefined;
    }

    return {
        title: action.title,
        text: action.text,
        buttonText: action.buttonText,
        onClick: action.onClick as PluginConfigurationAction['onClick'],
    };
}

function extractPluginConfigurationSection(section: unknown, pluginId: string) {
    if (!section) {
        return undefined;
    }

    if (typeof section !== 'object') {
        return undefined;
    }

    if (!('title' in section) || !section.title || typeof section.title !== 'string') {
        return undefined;
    }

    if ('component' in section) {
        if (!section.component || typeof section.component !== 'function') {
            return undefined;
        }

        try {
            const Component = section.component;
            if (!React.isValidElement((<Component/>))) {
                return undefined;
            }
        } catch {
            return undefined;
        }

        return {
            title: section.title,
            component: section.component as React.ComponentType,
        };
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

    let disabled;
    if ('disabled' in section && section.disabled) {
        if (typeof section.disabled === 'boolean') {
            disabled = section.disabled;
        } else {
            return undefined;
        }
    }

    const result: PluginConfigurationSection = {
        settings: [],
        title: section.title,
        disabled,
        onSubmit,
    };

    for (const setting of section.settings) {
        const validSetting = extractPluginConfigurationSetting(setting);
        if (validSetting) {
            result.settings.push(validSetting);
        } else {
            // eslint-disable-next-line no-console
            console.warn(`Plugin ${pluginId} is trying to register an invalid configuration section setting. Contact the plugin developer to fix this issue.`);
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
    case 'custom':
        return extractPluginConfigurationCustomSetting(setting, res);
    default:
        return undefined;
    }
}

function extractPluginConfigurationCustomSetting(setting: unknown, base: BasePluginConfigurationSetting) {
    if (!setting || typeof setting !== 'object') {
        return undefined;
    }

    if (!('component' in setting) || !setting.component || typeof setting.component !== 'function') {
        return undefined;
    }

    try {
        const Component = setting.component;
        if (!React.isValidElement((<Component/>))) {
            return undefined;
        }
    } catch {
        return undefined;
    }

    const res: PluginConfigurationCustomSetting = {
        ...base,
        type: 'custom',
        component: setting.component as PluginCustomSettingComponent,
    };

    return res;
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
