// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

describe('Archive channel header spec', () => {
    before(() => {
        cy.visit('/admin_console/user_management/permissions/system_scheme');

        // # Click reset to defaults and confirm
        cy.findByTestId('resetPermissionsToDefault').click();
        cy.get('#confirmModalButton').click();

        // # Ensure permissions for converting channel to private is enabled
        cy.findByTestId('all_users-public_channel-convert_public_channel_to_private-checkbox').then((el) => {
            if (!el.hasClass('checked')) {
                el.click();
            }
        });

        // # Save the settings
        cy.uiSave();
        cy.uiSaveButton().should('be.visible');

        // # Login as test user and visit create channel
        cy.apiInitSetup({loginAfter: true}).then(({channelUrl}) => {
            cy.visit(channelUrl);
        });
    });

    it('MM-T1717 Archived channel details cannot be edited', () => {
        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // * The dropdown menu of the channel header should be visible;
        cy.get('#channelLeaveChannel').should('be.visible');

        // * Channel Settings submenu should be visible;
        cy.get('#channelSettings').should('be.visible');

        // * Archive channel menu option should be visible;
        cy.get('#channelArchiveChannel').should('be.visible');

        // * Members menu option should be visible;
        cy.get('#channelMembers').should('be.visible');

        // * Notification preferences option should be visible;
        cy.get('#channelNotificationPreferences').should('be.visible');

        // # Close the channel dropdown menu using keyboard escape
        cy.get('body').type('{esc}{esc}');

        // # Archive the channel
        cy.uiArchiveChannel();

        // # click on channel drop-down menu
        cy.get('#channelHeaderTitle').click();

        // * Archive channel menu option should not be visible;
        cy.get('#channelArchiveChannel').should('not.exist');

        // * Channel Settings submenu should be visible;
        cy.get('#channelSettings').should('not.exist');

        // * Members menu option should be visible;
        // as it now displays in RHS
        cy.get('#channelMembers').should('be.visible');

        // * Notification preferences option should not be visible;
        cy.get('#channelNotificationPreferences').should('not.exist');

        // # Close the channel dropdown menu using keyboard escape
        cy.get('body').type('{esc}{esc}');
    });
});
