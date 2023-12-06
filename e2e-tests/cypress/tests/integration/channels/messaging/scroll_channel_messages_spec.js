// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

import {getAdminAccount} from '../../../support/env';

describe('Scroll channel`s messages in mobile view', () => {
    const sysadmin = getAdminAccount();
    let newChannel;

    before(() => {
        // # resize browser to phone view
        cy.viewport('iphone-6');

        // # Create and visit new channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            newChannel = channel;
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T127 Floating timestamp in mobile view', () => {
        let date;

        // # Post a year old message
        const oldDate = Cypress.dayjs().subtract(1, 'year').valueOf();
        for (let i = 0; i < 5; i++) {
            cy.postMessageAs({sender: sysadmin, message: 'Hello \n from \n other \n day \n - last year', channelId: newChannel.id, createAt: oldDate});
        }

        // # Post a day old message
        for (let j = 2; j >= 0; j--) {
            date = Cypress.dayjs().subtract(j, 'days').valueOf();
            for (let i = 0; i < 5; i++) {
                cy.postMessageAs({sender: sysadmin, message: `Hello \n from \n other \n day \n - ${j}`, channelId: newChannel.id, createAt: date});
            }
        }

        // # reload to see correct changes
        cy.reload();

        // * check date on scroll and save it
        cy.findAllByTestId('postView').eq(19).scrollIntoView();

        // * check date on scroll is today
        cy.findByTestId('floatingTimestamp').should('be.visible').and('have.text', 'Today');

        // * check date on scroll and save it
        cy.findAllByTestId('postView').eq(14).scrollIntoView();

        // * check date on scroll is yesterday
        cy.findByTestId('floatingTimestamp').should('be.visible').and('have.text', 'Yesterday');

        // * check date on scroll and save it
        cy.findAllByTestId('postView').eq(9).scrollIntoView();

        // * check date on scroll is two days ago as dddd
        cy.findByTestId('floatingTimestamp').should('be.visible').and('have.text', Cypress.dayjs().subtract(2, 'days').format('dddd'));

        cy.findAllByTestId('postView').eq(0).scrollIntoView();

        // * check date on scroll is 1 year ago as MMMM DD, YYYY
        cy.findByTestId('floatingTimestamp').should('be.visible').and('have.text', Cypress.dayjs().subtract(1, 'year').format('MMMM DD, YYYY'));
    });
});
