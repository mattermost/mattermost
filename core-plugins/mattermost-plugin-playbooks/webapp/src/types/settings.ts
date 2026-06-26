// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface GlobalSettings {
    link_run_to_existing_channel_enabled: boolean;
    enable_experimental_features: boolean;
}

const defaults: GlobalSettings = {
    link_run_to_existing_channel_enabled: false,
    enable_experimental_features: false,
};

export function globalSettingsSetDefaults(
    globalSettings?: Partial<GlobalSettings>,
): GlobalSettings {
    // If we didn't get anything just return defaults
    if (!globalSettings) {
        return defaults;
    }

    // Strip bad values from partial
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fixedGlobalSettings = Object.fromEntries(Object.entries(globalSettings).filter(([_, value]) => value !== null));

    return {...defaults, ...fixedGlobalSettings};
}
