// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import {getAdminAccount} from '../../support/env';

describe('Messaging', () => {
    const admin = getAdminAccount();
    let newChannel;

    before(() => {
        // # Create and visit new channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            newChannel = channel;

            cy.apiPatchMe({
                locale: 'en',
                timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-21482 Date separators should translate correctly', () => {
        function verifyDateSeparator(index, match) {
            cy.findAllByTestId('basicSeparator').eq(index).within(() => {
                cy.findByText(match);
            });
        }

        // # Post a message with old date
        const oldDate = Date.UTC(2019, 0, 5, 12, 30); // Jan 5, 2019 12:30pm
        cy.postMessageAs({sender: admin, message: 'Hello from Jan 5, 2019 12:30pm', channelId: newChannel.id, createAt: oldDate});

        // # Post message from 4 days ago
        const ago4 = Cypress.dayjs().subtract(4, 'days').valueOf();
        cy.postMessageAs({sender: admin, message: 'Hello from 4 days ago', channelId: newChannel.id, createAt: ago4});

        // # Post message from yesterday
        const yesterdaysDate = Cypress.dayjs().subtract(1, 'days').valueOf();
        cy.postMessageAs({sender: admin, message: 'Hello from yesterday', channelId: newChannel.id, createAt: yesterdaysDate});

        // # Post a message for today
        cy.postMessage('Hello from today');

        // # Reload to re-arrange post order
        cy.reload();

        // * Verify that the date separators are rendered in English
        verifyDateSeparator(0, /^January (04|05), 2019/);

        //! cannot test for MMMM DD format as it is current-year dependent, need fixed-time comparison

        verifyDateSeparator(1, /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/);
        verifyDateSeparator(2, 'Yesterday');
        verifyDateSeparator(3, 'Today');

        // # Change user locale to "es" and reload
        cy.apiPatchMe({locale: 'es'});
        cy.reload();

        // * Verify that the date separators are rendered in Spanish
        verifyDateSeparator(0, /^(04|05) de enero de 2019/);
        verifyDateSeparator(1, /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo)$/);
        verifyDateSeparator(2, 'Ayer');
        verifyDateSeparator(3, 'Hoy');

        // # Change user timezone which is not supported by react-intl and reload
        cy.apiPatchMe({timezone: {automaticTimezone: '', manualTimezone: 'NZ-CHAT', useAutomaticTimezone: 'false'}});
        cy.reload();

        // * Verify that it renders in "es" locale
        verifyDateSeparator(0, /^(04|05) de enero de 2019/);
    });
});
