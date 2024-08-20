// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAdminAccount} from './env';

function externalActivateUser(userId: string, active = true): Cypress.Chainable<unknown> {
    const admin = getAdminAccount();

    return cy.externalRequest({user: admin, method: 'put', path: `users/${userId}/active`, data: {active}});
}
Cypress.Commands.add('externalActivateUser', externalActivateUser);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Makes an external request as a sysadmin and activate/deactivate a user directly via API
             * @param {String} userId - The user ID
             * @param {Boolean} active - Whether to activate or deactivate - true/false
             *
             * @example
             *   cy.externalActivateUser('user-id', false);
             */
            externalActivateUser: typeof externalActivateUser;
        }
    }
}
