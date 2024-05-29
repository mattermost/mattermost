// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PreferencesType} from '@mattermost/types/preferences';

export function getPreferenceKey(category: string, name: string): string {
    return `${category}--${name}`;
}

export function getPreferencesByCategory(myPreferences: PreferencesType, category: string): Map<string, any> {
    const prefix = `${category}--`;
    const preferences = new Map();
    Object.keys(myPreferences).forEach((key) => {
        if (key.startsWith(prefix)) {
            preferences.set(key.substring(prefix.length), myPreferences[key]);
        }
    });

    return preferences;
}
