// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PluginConfiguration = {
    id: string;
    uiName: string;
    icon?: string;
    settings: PluginConfigurationSetting[];
}

export type BasePluginConfigurationSetting = {
    name: string;
    title: string;
    helpText?: string;
    onSubmit?: (name: string, value: string) => void;
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
