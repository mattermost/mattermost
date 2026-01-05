// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @interactive_dialog

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

let createdCommand;

describe('Interactive Dialog - Date and DateTime Fields', () => {
    let testTeam;
    let testChannel;

    // Helper functions to reduce code duplication
    const openDateTimeDialog = (command = '') => {
        cy.postMessage(`/${createdCommand.trigger} ${command}`);
        cy.get('#appsModal').should('be.visible');
    };

    const openDatePicker = (formGroupName) => {
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', formGroupName).within(() => {
                cy.get('.date-time-input').click();
            });
        });

        // Calendar should be visible with modal-overflow class automatically applied
        cy.get('.rdp', {timeout: 5000}).should('be.visible');
    };

    const selectDateFromPicker = (day) => {
        cy.get('.rdp-day').contains(day).first().click();
    };

    const verifyModalTitle = (title) => {
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalLabel').should('be.visible').and('contain', title);
        });
    };

    const verifyFormGroup = (groupName, options = {}) => {
        const selector = options.scrollIntoView ?
            cy.contains('.form-group', groupName).scrollIntoView().should('be.visible') :
            cy.contains('.form-group', groupName).should('be.visible');

        return selector.within(() => {
            if (options.label) {
                cy.get('label').should('contain', options.label);
            }
            if (options.helpText) {
                cy.get('.help-text').should('contain', options.helpText);
            }
            if (options.inputSelector) {
                cy.get(options.inputSelector).should('be.visible');
            }
        });
    };

    before(() => {
        cy.requireWebhookServer();

        // # Use apiInitSetup like the working boolean test
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for datetime dialog',
                display_name: 'DateTime Dialog',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'datetime_dialog',
                url: `${webhookBaseUrl}/datetime_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;

                // # Visit the test channel to ensure we're in the right place
                cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
            });
        });
    });

    beforeEach(() => {
        // # Ensure we're in the test channel before each test
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // # Wait for the channel to be fully loaded
        cy.get('#postListContent').should('be.visible');
        cy.get('#post_textbox').should('be.visible');
    });

    it('MM-T2530A - Date field UI and basic functionality', () => {
        // # Open datetime dialog and verify modal
        openDateTimeDialog('basic');
        verifyModalTitle('DateTime Fields Test');

        // * Verify the Event Date form group
        verifyFormGroup('Event Date', {
            label: 'Event Date',
            helpText: 'Select the date for your event',
            inputSelector: '.date-time-input',
        });

        // # Open date picker and select a date
        openDatePicker('Event Date');
        selectDateFromPicker('15');

        // * Verify the selected date appears in the field
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Event Date').within(() => {
                cy.get('.date-time-input__value').should('be.visible').and('not.be.empty');
            });
        });
    });

    it('MM-T2530B - DateTime field UI and functionality', () => {
        // # Open datetime dialog
        openDateTimeDialog();

        // * Verify the Meeting Time datetime field
        verifyFormGroup('Meeting Time', {
            label: 'Meeting Time',
            helpText: 'Select the date and time for your meeting',
            inputSelector: '.apps-form-datetime-input',
        });

        cy.get('#appsModal').within(() => {
            // * Verify datetime input structure
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.apps-form-datetime-input').within(() => {
                    cy.get('.dateTime').should('be.visible');
                    cy.get('.dateTime__date').should('be.visible');
                    cy.get('.dateTime__time').should('be.visible');
                });
            });

            // # Open date picker and select date
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__date .date-time-input').click();
            });
        });

        cy.get('.rdp', {timeout: 5000}).should('be.visible');
        selectDateFromPicker('20');

        // # Open time menu and select time
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__time button[data-testid="time_button"]').click();
            });
        });

        cy.get('[id="expiryTimeMenu"]', {timeout: 10000}).should('be.visible');
        cy.get('[id^="time_option_"]').first().click();
    });

    it('MM-T2530C - Date field validation with min_date constraint', () => {
        // # Open datetime dialog
        openDateTimeDialog('mindate');

        // * Verify the Future Date Only field with min_date constraint
        verifyFormGroup('Future Date Only', {
            label: 'Future Date Only',
            helpText: 'Must be today or later',
        });

        // # Open the date picker for constrained field
        openDatePicker('Future Date Only');

        // * Verify past dates are disabled and current dates are enabled
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDay = yesterday.getDate().toString();

        const today = new Date();
        const todayDay = today.getDate().toString();

        // Check if yesterday is visible and disabled
        cy.get('.rdp').then(($calendar) => {
            if ($calendar.find(`button:contains("${yesterdayDay}")`).length > 0) {
                cy.get(`button:contains("${yesterdayDay}")`).should('have.class', 'rdp-day_disabled').and('be.disabled');
            }
        });

        // Verify today is enabled and clickable
        cy.get('.rdp').find('button').filter((i, el) => el.textContent === todayDay.toString()).should('not.have.class', 'rdp-day_disabled').and('not.be.disabled');
        cy.get('.rdp').find('button').filter((i, el) => el.textContent === todayDay.toString()).click();

        // * Verify date selection
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Future Date Only').within(() => {
                cy.get('.date-time-input__value').should('be.visible').and('not.be.empty');
            });
        });
    });

    it('MM-T2530D - DateTime field with custom time interval', () => {
        // # Open datetime dialog with interval command
        cy.get('#postListContent').should('be.visible');
        openDateTimeDialog('interval');

        // * Verify custom interval datetime field
        verifyFormGroup('Custom Interval Time', {
            inputSelector: '.apps-form-datetime-input',
            scrollIntoView: true,
        });

        // # Open time menu
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Custom Interval Time').within(() => {
                cy.get('.dateTime__time button[data-testid="time_button"]').click();
            });
        });

        // * Verify time menu with custom intervals
        cy.get('[id="expiryTimeMenu"]', {timeout: 10000}).should('be.visible');
        cy.get('[id^="time_option_"]').should('have.length.greaterThan', 0);
    });

    it('MM-T2530E - Form submission with date and datetime values', () => {
        // # Open dialog and select date
        openDateTimeDialog('basic');
        openDatePicker('Event Date');
        selectDateFromPicker('15');

        // # Submit the form
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalSubmit').click();
        });

        // * Verify submission success
        cy.get('#appsModal', {timeout: 10000}).should('not.exist');
        cy.get('#postListContent', {timeout: 10000}).within(() => {
            cy.get('.post-message__text').last().should('contain', 'Form submitted successfully');
        });
    });

    it('MM-T2530F - Relative date values functionality', () => {
        // # Open datetime dialog
        openDateTimeDialog('relative');

        // * Verify relative date field with 'today' default is pre-populated
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Relative Date Example').scrollIntoView().should('be.visible').within(() => {
                cy.get('.date-time-input__value').should('be.visible').and('not.be.empty');
            });

            // * Verify relative datetime field with '+1d' default is pre-populated
            cy.contains('.form-group', 'Relative DateTime Example').scrollIntoView().should('be.visible').within(() => {
                cy.get('.apps-form-datetime-input').should('not.be.empty');
            });
        });
    });

    it('MM-T2530G - Date field locale formatting', () => {
        // # Set browser locale to en-US for consistent formatting
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`, {
            onBeforeLoad(win) {
                Object.defineProperty(win.navigator, 'language', {value: 'en-US'});
                Object.defineProperty(win.navigator, 'languages', {value: ['en-US', 'en']});
            },
        });

        // # Open dialog, select date, and verify locale formatting
        openDateTimeDialog('basic');
        openDatePicker('Event Date');
        selectDateFromPicker('10');

        // * Verify en-US locale formatting (e.g., "Aug 10, 2025")
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Event Date').within(() => {
                cy.get('.date-time-input__value').should('be.visible').and('not.be.empty').and('contain', '10').invoke('text').then((text) => {
                    expect(text).to.match(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
                });
            });
        });
    });
});
