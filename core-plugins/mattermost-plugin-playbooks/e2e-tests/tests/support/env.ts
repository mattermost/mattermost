// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface User {
    username: string;
    password: string;
    email: string;
}

export function getAdminAccount() {
    return {
        username: Cypress.env('adminUsername'),
        password: Cypress.env('adminPassword'),
        email: Cypress.env('adminEmail'),
    };
}

export function getDBConfig() {
    return {
        client: Cypress.env('dbClient'),
        connection: Cypress.env('dbConnection'),
    };
}
