// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface GlobalSettings {
    playbook_creators_user_ids: string[]
    enable_experimental_features: boolean
    link_run_to_existing_channel_enabled: boolean
}

const defaults: GlobalSettings = {
    playbook_creators_user_ids: [],
    enable_experimental_features: false,
    link_run_to_existing_channel_enabled: false,
};

export function globalSettingsSetDefaults(globalSettings?: Partial<GlobalSettings>): GlobalSettings {
    // If we didn't get anything just return defaults
    if (!globalSettings) {
        return defaults;
    }

    // Strip bad values from partial
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fixedGlobalSettings = Object.fromEntries(Object.entries(globalSettings).filter(([_, value]) => value !== null));

    return {...defaults, ...fixedGlobalSettings};
}
