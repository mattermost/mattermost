// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

declare namespace Cypress {
    interface Chainable {

        /**
         * Get a role from the provided role name.
         * See https://api.mattermost.com/#tag/roles/paths/~1roles~1name~1{role_name}/get
         * @param {string} name - role name, e.g. 'system_user'
         * @returns {Role} `out.role` as `Role`
         *
         * @example
         *   cy.getRoleByName('system_user').then(({role}) => {
         *       // do something with role
         *   });
         */
        getRoleByName(name: string): Chainable<Role>;

        /**
         * Get a list of roles by name.
         * See https://api.mattermost.com/#tag/roles/paths/~1roles~1names/post
         * @param {string[]} names - list of role names, e.g. ['system_user']
         * @returns {Role[]} `out.roles` as list of `Role` objects
         *
         * @example
         *   cy.apiGetRolesByNames(['system_user']).then(({roles}) => {
         *       // do something with roles
         *   });
         */
        apiGetRolesByNames(names: string[]): Chainable<{roles: Role[]}>;

        /**
         * Patch a role by ID.
         * See https://api.mattermost.com/#tag/roles/paths/~1roles~1{role_id}~1patch/put
         * @param {string} id - role ID
         * @param {Permissions} patch.permissions - permissions
         * @returns {Role} `out.role` as `Role`
         *
         * @example
         *   cy.apiPatchRole('role_id', patch).then(({role}) => {
         *       // do something with role
         *   });
         */
        apiPatchRole(id: string, patch: Record<string, any>): Chainable<Role>;

        /**
         * Reset roles to default values.
         *
         * @example
         *   cy.apiResetRoles();
         */
        apiResetRoles();
    }
}
