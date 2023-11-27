// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PluginConfiguration = {
    id: string;
    uiName: string;
    icon?: string;
    sections: PluginConfigurationSection[];
}

export type PluginConfigurationSection = {
    settings: PluginConfigurationSetting[];
    title: string;
    onSubmit?: (changes: {[name: string]: string}) => void;
}

export type BasePluginConfigurationSetting = {
    name: string;
    title?: string;
    helpText?: string;
    default?: string;
}

export type PluginConfigurationRadioSetting = BasePluginConfigurationSetting & {
    type: 'radio';
    default: string;
    options: PluginConfigurationRadioSettingOption[];
}

export type PluginConfigurationRadioSettingOption = {
    value: string;
    text: string;
    helpText?: string;
}

export type PluginConfigurationSetting = PluginConfigurationRadioSetting
