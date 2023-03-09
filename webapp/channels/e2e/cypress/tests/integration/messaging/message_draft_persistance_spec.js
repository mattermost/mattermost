// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

import localForage from 'localforage';

import {verifyDraftIcon} from './helpers';

describe('Message Draft Persistance', () => {
    let testChannel;

    let offTopicUrl;

    before(() => {
        // # Create new team and new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then((out) => {
            testChannel = out.channel;

            offTopicUrl = out.offTopicUrl;
        });
    });

    beforeEach(() => {
        localForage.clear();
    });

    it('MM-T4639 Persisting a draft in the current channel', () => {
        const testText = 'this is a test';

        // # Go to Off-Topic
        cy.visit(offTopicUrl);

        // # Type some text into the post textbox
        cy.uiGetPostTextBox().type(testText);

        // # Reload the page
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500).reload();

        // * Ensure the draft is back in the post textbox
        cy.uiGetPostTextBox().should('have.text', testText);
    });

    it('MM-T4640 Persisting a draft in another channel', () => {
        const testText = 'this is another test';

        // # Go to Off-Topic
        cy.visit(offTopicUrl);

        // # Type some text into the post textbox
        cy.uiGetPostTextBox().clear().type(testText);

        // # Switch to another channel
        cy.get(`#sidebarItem_${testChannel.name}`).click();

        // * Ensure the post textbox was cleared
        cy.uiGetPostTextBox().should('be.empty');

        // * Ensure Off-Topic has the draft icon
        verifyDraftIcon('off-topic', true);

        // # Reload the page
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500).reload();

        // * Ensure the post textbox is still empty
        cy.uiGetPostTextBox().should('be.empty');

        // * Ensure Off-Topic still has the draft icon
        cy.get('#sidebarItem_off-topic').
            should('be.visible').
            findByTestId('draftIcon').
            should('be.visible');

        // # Switch back to Off-Topic
        cy.get('#sidebarItem_off-topic').click();

        // * Ensure the draft is back in the post textbox
        cy.uiGetPostTextBox().should('have.text', testText);
    });

    it('MM-T4641 Migration of drafts from redux-persist@4.0.0', () => {
        const testText = 'this is a migration test';

        // # Go to Off-Topic
        cy.visit(offTopicUrl);

        // # Add a fake old draft to storage
        cy.then(() => {
            localForage.setItem(`reduxPersist:storage:draft_${testChannel.id}`, JSON.stringify({
                timestamp: new Date(),
                value: {
                    message: testText,
                    fileInfos: [],
                    uploadsInProgress: [],
                },
            }));
        });

        // # Refresh the app to trigger migration
        // eslint-disable-next-line cypress/no-unnecessary-waiting
        cy.wait(500).reload();

        // * Ensure the other channel has the draft icon
        verifyDraftIcon(testChannel.name, true);

        // # Switch to that channel
        cy.get(`#sidebarItem_${testChannel.name}`).click();

        // * Ensure the draft is in the post textbox
        cy.uiGetPostTextBox().should('have.text', testText);
    });
});
