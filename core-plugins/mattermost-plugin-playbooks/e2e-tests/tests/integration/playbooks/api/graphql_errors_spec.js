// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// ***************************************************************

// Stage: @prod
// Group: @playbooks

describe('api > graphql_errors', {testIsolation: true}, () => {
    let testUser;

    before(() => {
        cy.apiInitSetup().then(({user}) => {
            testUser = user;
        });
    });

    beforeEach(() => {
        // # Login as testUser
        cy.apiLogin(testUser);
    });

    it('return a generic error', () => {
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            url: '/plugins/playbooks/api/v0/query',
            body: {operationName: 'poc', query: 'query poc { __typename @a@a@a }'},
            method: 'POST',
            failOnStatusCode: false,
        }).then((response) => {
            expect(response.body.errors).to.have.length(1);
            expect(response.body.errors[0].message).to.equal('Error while executing your request');
        });
    });
});

