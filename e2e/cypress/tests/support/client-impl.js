// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Client4 from 'mattermost-redux/client/client4';

import clientRequest from '../plugins/client_request';

export class E2EClient extends Client4 {
    async doFetchWithResponse(url, options) {
        const {
            body,
            headers,
            method,
        } = this.getOptions(options);

        let data;
        if (body) {
            data = JSON.parse(body);
        }

        const response = await clientRequest({
            headers,
            url,
            method,
            data,
        });

        if (url.endsWith('/api/v4/users/login')) {
            this.setToken(response.headers.token);
            this.setUserId(response.data.id);
            this.setUserRoles(response.data.roles);
        }
        return response;
    }
}
