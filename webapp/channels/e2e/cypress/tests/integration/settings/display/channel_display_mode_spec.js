// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @account_setting

describe('Settings > Display > Channel Display Mode', () => {
    before(() => {
        // # Login as new user, visit off-topic and post a message
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage('Test for channel display mode');
        });
    });

    beforeEach(() => {
        cy.viewport(1500, 660);
    });

    it('should render in min setting view', () => {
        // # Go to Settings modal - Display section
        cy.uiOpenSettingsModal('Display');

        // * Check that the Display tab is loaded
        cy.get('#displayButton').should('be.visible');

        // # Click the Display tab
        cy.get('#displayButton').click();

        // * Check that it changed into the Display section
        cy.get('#displaySettingsTitle').should('contain', 'Display Settings');

        // # Scroll up to bring Channel Display setting in viewable area.
        cy.get('#channel_display_modeTitle').scrollIntoView();

        // * Check the min setting view if each element is present and contains expected text values
        cy.get('#channel_display_modeTitle').should('contain', 'Channel Display');
        cy.get('#channel_display_modeDesc').should('contain', 'Full width');
        cy.get('#channel_display_modeEdit').should('contain', 'Edit');
        cy.get('#accountSettingsHeader > .close').should('be.visible');
    });

    it('should render in max setting view', () => {
        // # Click "Edit" to the right of "Channel Display"
        cy.get('#channel_display_modeEdit').click();

        // # Scroll a bit to show the "Save" button
        cy.get('.section-max').scrollIntoView();

        // * Check that it changed into the Channel Display section
        // * Check the max setting view if each element is present and contains expected text values
        cy.get('#channel_display_modeFormatA').should('be.visible');
        cy.get('#channel_display_modeFormatB').should('be.visible');
        cy.get('#saveSetting').should('contain', 'Save');
        cy.get('#cancelSetting').should('contain', 'Cancel');
        cy.get('#accountSettingsHeader > .close').should('be.visible');
    });

    it('MM-T296 change channel display mode setting to "Full width"', () => {
        // # Click the radio button for "Full width"
        cy.get('#channel_display_modeFormatA').click();

        // # Click "Save"
        cy.uiSave();

        // * Check that it changed into min setting view
        // * Check if element is present and contains expected text values
        cy.get('#channel_display_modeDesc').
            should('be.visible').
            and('contain', 'Full width');

        // # Click "x" button to close Settings modal
        cy.uiClose();

        // * Validate if the post content in center channel is full width
        // by checking the exact class name.
        cy.get('#postListContent').should('be.visible');
        cy.findAllByTestId('postContent').
            first().
            should('have.class', 'post__content').
            and('not.have.class', 'center');
    });

    it('MM-T295 Channel display mode setting to "Fixed width, centered"', () => {
        // # Go to Settings modal - Display section
        cy.uiOpenSettingsModal('Display');

        // * Check that the Sidebar tab is loaded
        cy.get('#displayButton').should('be.visible');

        // # Click the display tab
        cy.get('#displayButton').click();

        // # Click "Edit" to the right of "Channel Display"
        cy.get('#channel_display_modeEdit').click();

        // # Scroll a bit to show the "Save" button
        cy.get('.section-max').scrollIntoView();

        // # Click the radio button for "Fixed width, centered"
        cy.get('#channel_display_modeFormatB').click();

        // # Click "Save"
        cy.uiSave();

        // * Check that it changed into min setting view
        // * Check if element is present and contains expected text values
        cy.get('#channel_display_modeDesc').
            should('be.visible').
            and('contain', 'Fixed width');

        // # Click "x" button to close Settings modal
        cy.uiClose();

        // # Go to channel which has any posts
        cy.get('#sidebarItem_town-square').click({force: true});

        // * Validate if the post content in center channel is fixed and centered
        // by checking the exact class name.
        cy.get('#postListContent').should('be.visible');
        cy.findAllByTestId('postContent').
            first().
            should('have.class', 'post__content center');
    });
});
