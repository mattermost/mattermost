// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PluginConfiguration = {
    id: string;
    uiName: string;
    icon?: string;
    settings: PluginConfigurationSetting[];
}

type BasePluginConfigurationSetting = {
    name: string;
    title: string;
    helpText?: string;
    onSubmit?: (name: string, value: string) => void;
    default: string;
}

type PluginConfigurationRadioSetting = BasePluginConfigurationSetting & {
    type: 'radio';
    options: Array<{
        value: string;
        text: string;
    }>;
}

export type PluginConfigurationSetting = PluginConfigurationRadioSetting
