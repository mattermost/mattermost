// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @account_setting

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Settings > Sidebar > General', () => {
    let testUser;
    let testTeam;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team, user, offTopicUrl}) => {
            testUser = user;
            testTeam = team;
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T3848 No nickname is present', () => {
        // # Open 'Profile' modal and view the default 'Profile'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            // # Open 'Nickname' setting
            cy.uiGetHeading('Nickname').click();

            // # Clear the nickname text field contents
            cy.uiGetTextbox('Nickname').should('be.visible').clear();

            // # Save and close the modal
            cy.uiSaveAndClose();
        });

        // # Open team menu and click "View Members"
        cy.uiOpenTeamMenu('View members');

        // # Search for username and check that no nickname is present
        cy.get('.modal-title').should('be.visible');
        cy.get('#searchUsersInput').should('be.visible').type(testUser.first_name).wait(TIMEOUTS.ONE_SEC);
        cy.findByTestId('userListItemDetails').find('.more-modal__name').should('be.visible').then((el) => {
            expect(getInnerText(el)).equal(`@${testUser.username} - ${testUser.first_name} ${testUser.last_name}`);
        });

        // # Close Team Members modal
        cy.uiClose();
    });

    it('MM-T268 Profile > Profile Settings > Add Nickname', () => {
        const newNickname = 'victor_nick';

        // # Open 'Profile' modal and view the default 'Profile Settings'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            // # Open 'Nickname' setting
            cy.uiGetHeading('Nickname').click();

            // # Clear the nickname text field contents
            cy.uiGetTextbox('Nickname').should('be.visible').clear().type('victor_nick');

            // # Save and close the modal
            cy.uiSaveAndClose();
        });

        // # Open team menu and click "View Members"
        cy.uiOpenTeamMenu('View members');

        // # Search for username and check that expected nickname is present
        cy.get('.modal-title').should('be.visible');
        cy.get('#searchUsersInput').should('be.visible').type(testUser.first_name).wait(TIMEOUTS.ONE_SEC);
        cy.findByTestId('userListItemDetails').find('.more-modal__name').should('be.visible').then((el) => {
            expect(getInnerText(el)).equal(`@${testUser.username} - ${testUser.first_name} ${testUser.last_name} (${newNickname})`);
        });

        // # Close Channel Members modal
        cy.uiClose();
    });

    it('MM-T2060 Nickname and username styles', () => {
        cy.apiCreateChannel(testTeam.id, 'channel-test', 'Channel').then(({channel}) => {
            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Go to Settings > Display
            cy.uiOpenSettingsModal('Display');

            // # Click Edit button beside Teammate Name Display
            cy.get('#name_formatEdit').click();

            // # Choose Show first and last name
            cy.get('#name_formatFormatC').check();

            // # Click Save button to save the settings
            cy.uiSave();
            cy.uiClose();

            // # Open channel menu and click 'Add Members'
            cy.uiOpenChannelMenu('Members');
            cy.uiGetButton('Add').click();

            // * Verify that the modal is open
            cy.get('#addUsersToChannelModal').should('be.visible').findByText(`Add people to ${channel.display_name}`);

            // # Type into the input box to search for a user
            cy.get('#selectItems input').typeWithForce('sys').wait(TIMEOUTS.ONE_SEC);

            // * Verify that the username span contains the '@' symbol and the dark colour
            cy.get('#multiSelectList > div > .more-modal__details > .more-modal__name > span').should('contain', '@').and('have.css', 'color', 'rgb(63, 67, 80)');

            // # Close modal
            cy.get('body').type('{esc}');

            // # Open DM modal from the sidebar
            cy.uiAddDirectMessage().click();

            // # Go to direct messages modal
            cy.get('.more-modal').should('be.visible').within(() => {
                cy.findByText('Direct Messages').click();
                cy.get('#selectItems input').typeWithForce('@');

                // * Verify that the username span contains the '@' symbol and the dark colour
                cy.get('.more-modal__details > .more-modal__name').should('contain', '@').and('have.css', 'color', 'rgb(63, 67, 80)');
            });

            // # Exit the modal
            cy.get('body').type('{esc}');
        });
    });

    it('MM-T2061 Nickname should reset on cancel of edit', () => {
        // # Open 'Profile' modal and view the default 'Profile Settings'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            // # Open 'Nickname' setting
            cy.uiGetHeading('Nickname').click();

            // # Clear the nickname text field contents
            cy.uiGetTextbox('Nickname').should('be.visible').clear().type('nickname_edit');

            // # Cancel the edit of nickname
            cy.uiCancelButton().click();
        });

        // # Click edit of nickname
        cy.uiGetHeading('Nickname').click();

        // * Check if element is present and contains old nickname
        cy.uiGetTextbox('Nickname').should('be.visible').should('contain', '');

        // # Close the modal
        cy.uiClose();
    });

    it('MM-T2062 Clear nickname and save', () => {
        // # Open 'Profile' modal and view the default 'Profile Settings'
        cy.uiOpenProfileModal('Profile Settings').within(() => {
            // # Open 'Nickname' setting
            cy.uiGetHeading('Nickname').click();

            // # Clear the nickname
            cy.uiGetTextbox('Nickname').clear();

            // * Check if nickname element is present and it does not contain any nickname
            cy.uiGetTextbox('Nickname').should('contain', '');
            cy.uiSaveButton().click();
        });

        // * Verify nickname help text is visible
        cy.get('#nicknameDesc').should('be.visible').should('contain', "Click 'Edit' to add a nickname");

        // # Close the modal
        cy.uiClose();
    });

    function getInnerText(el) {
        return el[0].innerText.replace(/\n/g, '').replace(/\s/g, ' ');
    }
});
