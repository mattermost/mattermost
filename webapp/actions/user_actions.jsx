// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import TeamStore from 'stores/team_store.jsx';

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
