// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import LocalizationStore from 'stores/localization_store.jsx';

export function convertTeamMapToList(teamMap) {
    const teams = [];

    for (const id in teamMap) {
        if (teamMap.hasOwnProperty(id)) {
            teams.push(teamMap[id]);
        }
    }

    return teams.sort(sortTeamsByDisplayName);
}

// Use when sorting multiple teams by their `display_name` field
export function sortTeamsByDisplayName(a, b) {
    const locale = LocalizationStore.getLocale();

    if (a.display_name !== b.display_name) {
        return a.display_name.localeCompare(b.display_name, locale, {numeric: true});
    }

    return a.name.localeCompare(b.name, locale, {numeric: true});
}
