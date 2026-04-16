// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';

export interface User {
    username: string;
    password: string;
    email: string;
}

export function getAdminAccount() {
    return {
        username: Cypress.expose('adminUsername'),
        password: Cypress.expose('adminPassword'),
        email: Cypress.expose('adminEmail'),
    } as UserProfile;
}

export function getDBConfig() {
    return {
        client: Cypress.expose('dbClient'),
        connection: Cypress.expose('dbConnection'),
    };
}
