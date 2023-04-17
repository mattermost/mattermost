// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *****************************************************************************
// Groups
// https://api.mattermost.com/#tag/groups
// *****************************************************************************

import {ChainableT} from '../../types';

function apiCreateCustomUserGroup(displayName: string, name: string, userIds: string[]): ChainableT<Cypress.Group> {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/groups',
        method: 'POST',
        body: {
            display_name: displayName,
            name,
            source: 'custom',
            allow_reference: true,
            user_ids: userIds,
        },
    }).then((response) => {
        expect(response.status).to.equal(201);
        return cy.wrap(response);
    });
}

Cypress.Commands.add('apiCreateCustomUserGroup', apiCreateCustomUserGroup);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Create custom user group
             * @param {string} displayName - the display name of the group
             * @param {string} name - the @ mentionable name of the group
             * @param {string[]} userIds - users to add to the group
             */
            apiCreateCustomUserGroup: typeof apiCreateCustomUserGroup;
        }
    }
}
