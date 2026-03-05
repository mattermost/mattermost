// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function createContext() {
    return {
        baseUrl: null,
        webhookBaseUrl: null,
        adminUsername: null,
        adminPassword: null,
        oauthClient: null,
        authedUser: null,
    };
}

module.exports = { createContext };
