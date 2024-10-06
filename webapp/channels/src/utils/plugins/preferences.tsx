// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getPluginPreferenceKey(pluginId: string) {
    return `pp_${pluginId}`.slice(0, 32);
}
