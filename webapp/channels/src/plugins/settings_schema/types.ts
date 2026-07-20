// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

// Generic, context-agnostic settings schema primitives shared by every
// declarative plugin settings surface. Each context builds on top of these by
// intersecting its own fields: Channel Settings adds a save handler
// (`types/plugins/channel_settings.ts`) and User Settings adds per-section save
// side effects and a tab action (`types/plugins/user_settings.ts`). Extraction
// and controls are likewise shared (`extract_settings_schema.tsx`, `controls/`).

export type BaseSetting = {

    /** Identifies the setting; used as the key when collecting values. */
    name: string;

    /** Optional header for this setting. */
    title?: string;

    /** Optional help text for this setting. */
    helpText?: string;

    /** The default value to use. */
    default?: string;
};

export type RadioSettingOption = {

    /** The value to store. */
    value: string;

    /** The text to show in the UI. */
    text: string;

    /** Optional help text for this option. */
    helpText?: string;
};

export type RadioSetting = BaseSetting & {
    type: 'radio';

    /** The default value to use. */
    default: string;

    options: RadioSettingOption[];
};

/** A plugin-provided control. It reports value changes through `informChange`. */
export type CustomSettingComponent = React.ComponentType<{informChange: (name: string, value: string) => void}>;

export type CustomSetting = BaseSetting & {
    type: 'custom';

    /** A React component used to render the custom setting. */
    component: CustomSettingComponent;
};

export type Setting = RadioSetting | CustomSetting;

export type SettingsSection = {

    /** The title of the section. All titles within a schema must be different. */
    title: string;

    settings: Setting[];

    /** Whether the section is disabled. */
    disabled?: boolean;
};

export type CustomSection = {

    /** The title of the section. All titles within a schema must be different. */
    title: string;

    /** A React component used to render the whole section. */
    component: React.ComponentType;
};

export type SettingsSchema = {

    /** Name shown for the schema in the UI. */
    uiName: string;

    /** Optional icon string, such as a CSS class name or URL/path. */
    icon?: string;

    sections: Array<SettingsSection | CustomSection>;
};
