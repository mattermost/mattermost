// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'utils/web_client.jsx';

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
