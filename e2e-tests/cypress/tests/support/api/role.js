// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import xor from 'lodash.xor';

import {defaultRolesPermissions} from './default_roles_permissions';

// *****************************************************************************
// Preferences
// https://api.mattermost.com/#tag/roles
// *****************************************************************************

export {defaultRolesPermissions};

Cypress.Commands.add('getRoleByName', (name) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/roles/name/${name}`,
        method: 'GET',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({name: response.body});
    });
});

Cypress.Commands.add('apiGetRolesByNames', (names) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/roles/names',
        method: 'POST',
        body: names || Object.keys(defaultRolesPermissions),
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({roles: response.body});
    });
});

Cypress.Commands.add('apiPatchRole', (roleID, patch) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/roles/${roleID}/patch`,
        method: 'PUT',
        body: patch,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({role: response.body});
    });
});

Cypress.Commands.add('apiResetRoles', () => {
    cy.apiGetRolesByNames().then(({roles}) => {
        roles.forEach((role) => {
            const permissions = getPermissions(role.name);
            const diff = xor(role.permissions, permissions)?.filter((p) => p?.length);

            if (diff?.length > 0) {
                cy.apiPatchRole(role.id, {permissions});
            }
        });
    });
});

function getPermissions(roleName) {
    const permissions = defaultRolesPermissions[roleName];
    if (!permissions) {
        return [];
    }
    return permissions.split(' ').map((permission) => permission.trim()).filter((permission) => permission !== '');
}
