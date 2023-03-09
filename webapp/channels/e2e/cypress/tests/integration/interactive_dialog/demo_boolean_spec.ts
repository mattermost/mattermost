// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @interactive_dialog @plugin

// If the contents of the interactive dialog from the demo plugin change, please update the demoPluginDialogElements object.

import {demoPlugin} from '../../utils/plugins';

describe('Interactive Dialogs', () => {
    let testTeam;
    let testChannel;

    // # The format of the elements in the interactive dialog from the demo plugin:
    const demoPluginDialogElements = [
        {
            display_name: 'Display Name',
            name: 'realname',
            type: 'text',
            default: 'default text',
            placeholder: 'placeholder',
            help_text: 'This a regular input in an interactive dialog triggered by a test integration.',
        }, {
            display_name: 'Email',
            name: 'someemail',
            type: 'text',
            subtype: 'email',
            placeholder: 'placeholder@bladekick.com',
            help_text: 'This a regular email input in an interactive dialog triggered by a test integration.',
        }, {
            display_name: 'Password',
            name: 'somepassword',
            type: 'text',
            subtype: 'password',
            placeholder: 'Password',
            help_text: 'This a password input in an interactive dialog triggered by a test integration.',
        }, {
            display_name: 'Number',
            name: 'somenumber',
            type: 'text',
            subtype: 'number',
        }, {
            display_name: 'Display Name Long Text Area',
            name: 'realnametextarea',
            type: 'textarea',
            placeholder: 'placeholder',
            optional: true,
            min_length: 5,
            max_length: 100,
        }, {
            display_name: 'User Selector',
            name: 'someuserselector',
            type: 'select',
            placeholder: 'Select a user...',
            help_text: 'Choose a user from the list.',
            optional: true,
            min_length: 5,
            max_length: 100,
            data_source: 'users',
        }, {
            display_name: 'Channel Selector',
            name: 'somechannelselector',
            type: 'select',
            placeholder: 'Select a channel...',
            help_text: 'Choose a channel from the list.',
            optional: true,
            min_length: 5,
            max_length: 100,
            data_source: 'channels',
        }, {
            display_name: 'Option Selector',
            name: 'someoptionselector',
            type: 'select',
            placeholder: 'Select an option...',
            help_text: 'Choose an option from the list.',
            options: [{
                text: 'Option1',
                value: 'opt1',
            }, {
                text: 'Option2',
                value: 'opt2',
            }, {
                text: 'Option3',
                value: 'opt3',
            }],
        }, {
            display_name: 'Option Selector with default',
            name: 'someoptionselector2',
            type: 'select',
            default: 'opt2',
            placeholder: 'Select an option...',
            help_text: 'Choose an option from the list.',
            options: [{
                text: 'Option1',
                value: 'opt1',
            }, {
                text: 'Option2',
                value: 'opt2',
            }, {
                text: 'Option3',
                value: 'opt3',
            }],
        }, {
            display_name: 'Boolean Selector',
            name: 'someboolean',
            type: 'bool',
            placeholder: 'Agree to the terms of service',
            help_text: 'You must agree to the terms of service to proceed.',
        }, {
            display_name: 'Boolean Selector',
            name: 'someboolean_optional',
            type: 'bool',
            placeholder: 'Sign up for monthly emails?',
            help_text: "It's up to you if you want to get monthly emails.",
            optional: true,
        }, {
            display_name: 'Boolean Selector (default true)',
            name: 'someboolean_default_true',
            type: 'bool',
            placeholder: 'Enable secure login',
            help_text: 'You must enable secure login to proceed.',
            default: 'true',
        }, {
            display_name: 'Boolean Selector (default true)',
            name: 'someboolean_default_true_optional',
            type: 'bool',
            placeholder: 'Enable painfully secure login',
            help_text: 'You may optionally enable painfully secure login.',
            default: 'true',
            optional: true,
        }, {
            display_name: 'Boolean Selector (default false)',
            name: 'someboolean_default_false',
            type: 'bool',
            placeholder: 'Agree to the annoying terms of service',
            help_text: 'You must also agree to the annoying terms of service to proceed.',
            default: 'false',
        }, {
            display_name: 'Boolean Selector (default false)',
            name: 'someboolean_default_false_optional',
            type: 'bool',
            placeholder: 'Throw-away account',
            help_text: 'A throw-away account will be deleted after 24 hours.',
            default: 'false',
            optional: true,
        }, {
            display_name: 'Radio Option Selector',
            name: 'someradiooptionselector',
            type: 'radio',
            help_text: 'Choose an option from the list.',
            options: [{
                text: 'Option1',
                value: 'opt1',
            }, {
                text: 'Option2',
                value: 'opt2',
            }, {
                text: 'Option3',
                value: 'opt3',
            }],
        },
    ];

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Set plugin settings
        const newSettings = {
            PluginSettings: {
                Enable: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            // # Install demo plugin by file
            cy.apiUploadAndEnablePlugin(demoPlugin);

            // # Visit the test channel
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        });
    });

    it('MM-T2503 Boolean value check', () => {
        // # Post the /dialog slash command message
        cy.uiGetPostTextBox().type('/dialog {enter}');

        // * Check that the interactive dialog modal from the plugin opens up
        cy.get('#interactiveDialogModal').should('be.visible').within(() => {
            // * Verify that the body is visible
            cy.get('.modal-body').should('be.visible').children().each(($elForm, index) => {
                const element = demoPluginDialogElements[index];

                // * Verify that when the element comes into view the proper display name is showing
                cy.wrap($elForm).find('label.control-label').scrollIntoView().should('be.visible').and('have.text', `${element.display_name} ${element.optional ? '(optional)' : '*'}`);

                if (element.name.includes('someboolean')) {
                    // * Verify that the checkbox for a boolean element is visible
                    cy.wrap($elForm).find('.checkbox').should('be.visible').within(() => {
                        // * Verify that if the element default is true, it should be checked, and vice versa.
                        let checked = true;
                        if (element.default === 'true') {
                            cy.get(`#${element.name}`).
                                should('be.visible').
                                and('be.checked');
                        } else {
                            cy.get(`#${element.name}`).
                                should('be.visible').
                                not('be.checked');
                            checked = false;
                        }

                        // * Verify that the checkbox has the proper text.
                        cy.get('span').should('have.text', element.placeholder);

                        // # Click on the checkbox.
                        if (checked === false) {
                            cy.get(`#${element.name}`).check();
                        }
                    });
                } else if (element.name === 'someemail') {
                    cy.get(`#${element.name}`).scrollIntoView().clear().type('test@test.com');
                } else if (element.name === 'somepassword') {
                    cy.get(`#${element.name}`).scrollIntoView().clear().type('test');
                } else if (element.name === 'somenumber') {
                    cy.get(`#${element.name}`).scrollIntoView().clear().type('42');
                } else if (element.name === 'someoptionselector') {
                    cy.wrap($elForm).find('input').click();
                    cy.wrap($elForm).find('#suggestionList').scrollIntoView().should('be.visible').click();
                } else if (element.name === 'someradiooptionselector') {
                    cy.wrap($elForm).find('input').first().click();
                }
            });

            // # Submit the form of the interactive dialog.
            cy.intercept('/api/v4/actions/dialogs/submit').as('submitAction');
            cy.get('#interactiveDialogSubmit').click();
        });

        // * The interactive dialog should not be visible anymore.
        cy.get('#interactiveDialogModal').not('be.visible');

        // * Verify that submitted values are boolean and not strings.
        cy.wait('@submitAction').should('include.all.keys', ['request', 'response']).then((result) => {
            const boolQuestions = Object.entries(result.request.body.submission).filter((element) => element[0].includes('someboolean'));
            for (let i = 0; i < boolQuestions.length; i++) {
                assert.isBoolean(boolQuestions[i][1]);
            }
        });
    });
});
