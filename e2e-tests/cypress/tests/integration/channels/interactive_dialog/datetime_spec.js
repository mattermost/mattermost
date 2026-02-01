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

    it('MM-T2530H - DateTime field respects 12h/24h time preference', () => {
        // # Set user preference to 24-hour time
        cy.apiSaveClockDisplayModeTo24HourPreference(true);

        cy.reload();
        cy.get('#postListContent').should('be.visible');

        // # Open datetime dialog
        openDateTimeDialog();

        // * Verify Meeting Time field
        verifyFormGroup('Meeting Time', {
            inputSelector: '.apps-form-datetime-input',
        });

        // # Select a date
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__date .date-time-input').click();
            });
        });

        cy.get('.rdp', {timeout: 5000}).should('be.visible');
        selectDateFromPicker('15');

        // # Open time menu
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__time button[data-testid="time_button"]').click();
            });
        });

        // * Verify 24-hour format in dropdown (e.g., "14:00" not "2:00 PM")
        cy.get('[id="expiryTimeMenu"]', {timeout: 10000}).should('be.visible');
        cy.get('[id^="time_option_"]').first().invoke('text').then((text) => {
            expect(text).to.match(/^\d{2}:\d{2}$/); // 24-hour format: HH:MM
        });

        // # Select a time
        cy.get('[id^="time_option_"]').eq(5).click();

        // * Verify selected time shows in 24-hour format
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__time .date-time-input__value').invoke('text').then((text) => {
                    expect(text).to.match(/^\d{2}:\d{2}$/);
                });
            });
        });

        // # Close dialog
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalCancel').click();
        });

        // # Set user preference to 12-hour time
        cy.apiSaveClockDisplayModeTo24HourPreference(false);

        cy.reload();
        cy.get('#postListContent').should('be.visible');

        // # Open dialog again
        openDateTimeDialog();

        // # Select date and open time menu
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__date .date-time-input').click();
            });
        });

        cy.get('.rdp').should('be.visible');
        selectDateFromPicker('20');

        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Meeting Time').within(() => {
                cy.get('.dateTime__time button[data-testid="time_button"]').click();
            });
        });

        // * Verify 12-hour format in dropdown (e.g., "2:00 PM" not "14:00")
        cy.get('[id="expiryTimeMenu"]').should('be.visible');
        cy.get('[id^="time_option_"]').first().invoke('text').then((text) => {
            expect(text).to.match(/\d{1,2}:\d{2} [AP]M/); // 12-hour format: H:MM AM/PM
        });
    });

    it('MM-T2530O - Manual time entry (basic functionality)', () => {
        // # Open timezone-manual dialog via webhook
        openDateTimeDialog('timezone-manual');
        verifyModalTitle('Timezone & Manual Entry Demo');

        // * Verify local manual entry field exists
        verifyFormGroup('Your Local Time (Manual Entry)', {
            helpText: 'Type any time',
        });

        // # Type a time in manual entry field
        cy.get('#appsModal').within(() => {
            cy.contains('.form-group', 'Your Local Time (Manual Entry)').within(() => {
                cy.get('input#time_input').should('be.visible').type('3:45pm').blur();
            });
        });

        // * Verify time is accepted (no error state)
        cy.contains('.form-group', 'Your Local Time (Manual Entry)').within(() => {
            cy.get('input#time_input').should('not.have.class', 'error');
            cy.get('input#time_input').should('have.value', '3:45 PM');
        });

        // # Submit form
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalSubmit').click();
        });

        // * Verify submission success
        cy.get('#appsModal', {timeout: 10000}).should('not.exist');
    });

    it('MM-T2530P - Manual time entry (multiple formats)', () => {
        openDateTimeDialog('timezone-manual');

        const testFormats = [
            {input: '12a', expected12h: '12:00 AM'},
            {input: '14:30', expected12h: '2:30 PM'},
            {input: '9pm', expected12h: '9:00 PM'},
        ];

        testFormats.forEach(({input, expected12h}) => {
            cy.contains('.form-group', 'Your Local Time (Manual Entry)').within(() => {
                cy.get('input#time_input').clear().type(input).blur();

                // Wait for formatting to apply
                cy.wait(100);

                // Verify time is formatted correctly (assumes 12h preference for test consistency)
                cy.get('input#time_input').invoke('val').should('equal', expected12h);
            });
        });
    });

    it('MM-T2530Q - Manual time entry (invalid format)', () => {
        openDateTimeDialog('timezone-manual');

        // # Type invalid time
        cy.contains('.form-group', 'Your Local Time (Manual Entry)').within(() => {
            cy.get('input#time_input').type('abc').blur();

            // * Verify error state
            cy.get('input#time_input').should('have.class', 'error');
        });

        // # Type valid time
        cy.contains('.form-group', 'Your Local Time (Manual Entry)').within(() => {
            cy.get('input#time_input').clear().type('2:30pm').blur();

            // * Verify error clears
            cy.get('input#time_input').should('not.have.class', 'error');
        });
    });

    it('MM-T2530R - Timezone support (dropdown)', function() {
        // Skip if running in London timezone (can't test timezone conversion)
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone === 'Europe/London' || userTimezone === 'GMT' || userTimezone.includes('London')) {
            this.skip();
        }

        openDateTimeDialog('timezone-manual');

        // * Verify timezone indicator is shown
        cy.contains('.form-group', 'London Office Hours (Dropdown)').within(() => {
            cy.contains('Times in GMT').should('be.visible');
        });

        // # Select a date
        cy.contains('.form-group', 'London Office Hours (Dropdown)').within(() => {
            cy.get('.dateTime__date .date-time-input').click();
        });

        cy.get('.rdp').should('be.visible');
        selectDateFromPicker('15');

        // # Open time dropdown
        cy.contains('.form-group', 'London Office Hours (Dropdown)').within(() => {
            cy.get('.dateTime__time button[data-testid="time_button"]').click();
        });

        // * Verify dropdown shows times starting at midnight (London time)
        cy.get('[id="expiryTimeMenu"]').should('be.visible');
        cy.get('[id^="time_option_"]').first().invoke('text').then((text) => {
            // Should show midnight in 12h or 24h format
            expect(text).to.match(/^(12:00 AM|00:00)$/);
        });

        // # Select a time
        cy.get('[id^="time_option_"]').eq(5).click();

        // # Submit form
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalSubmit').click();
        });

        // * Verify submission success (UTC conversion verified server-side)
        cy.get('#appsModal', {timeout: 10000}).should('not.exist');
    });

    it('MM-T2530S - Timezone support (manual entry)', function() {
        // Skip if running in London timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone === 'Europe/London' || userTimezone === 'GMT' || userTimezone.includes('London')) {
            this.skip();
        }

        openDateTimeDialog('timezone-manual');

        // * Verify timezone indicator is shown
        cy.contains('.form-group', 'London Office Hours (Manual Entry)').within(() => {
            cy.contains('Times in GMT').should('be.visible');
        });

        // # Select date
        cy.contains('.form-group', 'London Office Hours (Manual Entry)').within(() => {
            cy.get('.dateTime__date .date-time-input').click();
        });

        cy.get('.rdp').should('be.visible');
        selectDateFromPicker('15');

        // # Type time in manual entry
        cy.contains('.form-group', 'London Office Hours (Manual Entry)').within(() => {
            cy.get('input#time_input').clear().type('2:30pm').blur();

            // * Verify time is accepted
            cy.get('input#time_input').should('not.have.class', 'error');
        });

        // # Submit form
        cy.get('#appsModal').within(() => {
            cy.get('#appsModalSubmit').click();
        });

        // * Verify submission success (timezone conversion happens server-side)
        cy.get('#appsModal', {timeout: 10000}).should('not.exist');
    });
});
