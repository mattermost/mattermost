// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    BaseSetting,
    CustomSection,
    CustomSetting,
    CustomSettingComponent,
    RadioSetting,
    RadioSettingOption,
    Setting,
    SettingsSchema,
    SettingsSection,
} from 'plugins/settings_schema/types';

// User Settings builds on the shared declarative settings schema. The public
// type names below are kept as aliases so existing importers (and plugins
// registering user settings) keep compiling unchanged.

export type BasePluginConfigurationSetting = BaseSetting;
export type PluginConfigurationRadioSettingOption = RadioSettingOption;
export type PluginConfigurationRadioSetting = RadioSetting;
export type PluginCustomSettingComponent = CustomSettingComponent;
export type PluginConfigurationCustomSetting = CustomSetting;
export type PluginConfigurationSetting = Setting;
export type PluginConfigurationCustomSection = CustomSection;

/** A declarative section, plus the User Settings save side effect. */
export type PluginConfigurationSection = SettingsSection & {

    /**
     * Called whenever the section is saved.
     *
     * The configuration is automatically saved in the user preferences, so use
     * this only to add a side effect to the change.
     */
    onSubmit?: (changes: {[name: string]: string}) => void;
};

export type PluginConfigurationAction = {

    /** Text shown as the title of the action */
    title: string;

    /** Text shown as the body of the action */
    text: string;

    /** Text shown at the button */
    buttonText: string;

    /** This function is called when the button on the action is clicked */
    onClick: () => void;
};

export type PluginConfiguration = Omit<SettingsSchema, 'sections'> & {

    /** Plugin ID */
    id: string;

    /** Action that will appear at the beginning of the plugin settings tab */
    action?: PluginConfigurationAction;

    sections: Array<PluginConfigurationSection | PluginConfigurationCustomSection>;
};
