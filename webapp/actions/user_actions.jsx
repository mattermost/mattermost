// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import Client from 'client/web_client.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import TeamStore from 'stores/team_store.jsx';
import UserStore from 'stores/user_store.jsx';

import {ActionTypes, Preferences} from 'utils/constants.jsx';

export function switchFromLdapToEmail(email, password, ldapPassword, onSuccess, onError) {
    Client.ldapToEmail(
        email,
        password,
        ldapPassword,
        (data) => {
            if (data.follow_link) {
                window.location.href = data.follow_link;
            }

            if (onSuccess) {
                onSuccess(data);
            }
        },
        onError
    );
}

export function getMoreDmList() {
    AsyncClient.getProfilesForDirectMessageList();
    AsyncClient.getTeamMembers(TeamStore.getCurrentId());
}

export function saveTheme(teamId, theme, onSuccess, onError) {
    AsyncClient.savePreference(
        Preferences.CATEGORY_THEME,
        teamId,
        JSON.stringify(theme),
        () => {
            onThemeSaved(teamId, theme, onSuccess);
        },
        (err) => {
            onError(err);
        }
    );
}

function onThemeSaved(teamId, theme, onSuccess) {
    const themePreferences = PreferenceStore.getCategory(Preferences.CATEGORY_THEME);

    if (teamId !== '' && themePreferences.size > 1) {
        // no extra handling to be done to delete team-specific themes
        onSuccess();
        return;
    }

    const toDelete = [];

    for (const [name] of themePreferences) {
        if (name === '') {
            continue;
        }

        toDelete.push({
            user_id: UserStore.getCurrentId(),
            category: Preferences.CATEGORY_THEME,
            name
        });
    }

    // we're saving a new global theme so delete any team-specific ones
    AsyncClient.deletePreferences(toDelete);

    // delete them locally before we hear from the server so that the UI flow is smoother
    AppDispatcher.handleServerAction({
        type: ActionTypes.DELETED_PREFERENCES,
        preferences: toDelete
    });

    onSuccess();
}