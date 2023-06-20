// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @status @timed_dnd

describe('DND Status - Setting Your Own DND Status', () => {
    const dndTimes = [
        'dndTime-thirty_minutes_menuitem',
        'dndTime-one_hour_menuitem',
        'dndTime-two_hours_menuitem',
        'dndTime-tomorrow_menuitem',
        'dndTime-custom_menuitem',
    ];

    before(() => {
        cy.shouldHaveFeatureFlag('TimedDND', true);

        // # Login as test user and visit channel
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-8497_1 Set status DND with predefined end times', () => {
        // # Loop through all predefined end times and verify them
        for (let i = 0; i < 4; i++) {
            // # Open status dropdown menu and hover over Do Not Disturb option
            openDndStatusSubMenu();

            // # Click on predefined end time
            cy.get(`.SubMenuItemContainer li#${dndTimes[i]}`).click();

            // * Verify user status icon is set to DND
            cy.uiGetProfileHeader().
                find('i').
                should('be.visible').
                and('have.class', 'icon-minus-circle');

            // # Reset user status to online to prevent status modal
            cy.apiUpdateUserStatus('online');

            cy.reload();
        }
    });

    it('MM-8497_2 Set status DND with custom end time', () => {
        // # Open status dropdown menu and hover over Do Not Disturb option
        openDndStatusSubMenu();

        // # Click on Custom end time
        cy.get(`.SubMenuItemContainer li#${dndTimes[4]}`).click();

        // # Click 'Disable Notification' in custom time selection modal to choose pre-filled time
        cy.get('.DndModal__footer span').should('have.text', 'Disable Notifications').click();

        // * Verify user status icon is set to DND
        verifyDNDUserStatus();

        // # Reset user status to online to prevent status modal
        cy.apiUpdateUserStatus('online');

        cy.reload();

        // Select only custom date in dnd time selection modal

        // # Open status dropdown menu and hover over Do Not Disturb option
        openDndStatusSubMenu();

        // # Click on Custom end time
        cy.get(`.SubMenuItemContainer li#${dndTimes[4]}`).click();

        // # Click on DayPicker input field
        cy.get('.DayPickerInput input').click();

        // * Verify that DayPicker overlay is visible
        cy.get('.DayPickerInput-Overlay').should('be.visible');

        // # Click on tomorrow's day
        cy.get('.DayPickerInput-Overlay').find('.DayPicker-Day--today').next('.DayPicker-Day').click();

        // # Click 'Disable Notification' button
        cy.get('.DndModal__footer span').should('have.text', 'Disable Notifications').click();

        // * Verify user status icon is set to DND
        verifyDNDUserStatus();

        // # Reset user status to online to prevent status modal
        cy.apiUpdateUserStatus('online');

        cy.reload();

        // Select only custom time in dnd time selection modal

        // # Open status dropdown menu and hover over Do Not Disturb option
        openDndStatusSubMenu();

        // # Click on Custom end time
        cy.get(`.SubMenuItemContainer li#${dndTimes[4]}`).click();

        // # Click on time picker input field
        cy.get('.MenuWrapper .DndModal__input').click();

        // * Verify that time picker menu is visible
        cy.get('ul.Menu__content.dropdown-menu').should('be.visible');

        // # Click on last time available in list
        cy.get('ul.Menu__content.dropdown-menu').last('.MenuItem').click();

        // # Click 'Disable Notification' button
        cy.get('.DndModal__footer span').should('have.text', 'Disable Notifications').click();

        // * Verify user status icon is set to DND
        verifyDNDUserStatus();

        // # Reset user status to online to prevent status modal
        cy.apiUpdateUserStatus('online');

        cy.reload();

        // Select both custom date and time in dnd time selection modal

        // # Open status dropdown menu and hover over Do Not Disturb option
        openDndStatusSubMenu();

        // # Click on Custom end time
        cy.get(`.SubMenuItemContainer li#${dndTimes[4]}`).click();

        // # Click on DayPicker input field
        cy.get('.DayPickerInput input').click();

        // * Verify that DayPicker overlay is visible
        cy.get('.DayPickerInput-Overlay').should('be.visible');

        // # Click on tomorrow's day
        cy.get('.DayPickerInput-Overlay').find('.DayPicker-Day--today').next('.DayPicker-Day').click();

        // # Click on time picker input field
        cy.get('.MenuWrapper .DndModal__input').click();

        // * Verify that time picker menu is visible
        cy.get('ul.Menu__content.dropdown-menu').should('be.visible');

        // # Click on last time available in list
        cy.get('ul.Menu__content.dropdown-menu').last('.MenuItem').click();

        // # Click 'Disable Notification' button
        cy.get('.DndModal__footer span').should('have.text', 'Disable Notifications').click();

        // * Verify user status icon is set to DND
        verifyDNDUserStatus();
    });
});

function openDndStatusSubMenu() {
    // # Open status menu
    cy.uiGetSetStatusButton().click();

    // # Hover over Do Not Disturb option
    cy.findByText('Do Not Disturb').trigger('mouseover');
}

function verifyDNDUserStatus() {
    cy.uiGetProfileHeader().
        find('i').
        should('be.visible').
        and('have.class', 'icon-minus-circle');
}
