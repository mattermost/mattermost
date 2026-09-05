// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';
const playbookRunStartCommand = '/playbook run';

Cypress.Commands.add('startPlaybookRun', (playbookName, playbookRunName) => {
    cy.get('#appsModal').should('exist').within(() => {
        // # Select playbook
        cy.selectPlaybookFromDropdown(playbookName);

        // # Type playbook run name
        cy.findByTestId('playbookRunNameinput').type(playbookRunName, {force: true});

        // # Submit
        cy.get('#appsModalSubmit').click();
    });

    cy.get('#appsModal').should('not.exist');
});

// Opens playbook run dialog using the `/playbook run` slash command
Cypress.Commands.add('openPlaybookRunDialogFromSlashCommand', () => {
    cy.uiPostMessageQuickly(playbookRunStartCommand);
});

// Starts playbook run with the `/playbook run` slash command
Cypress.Commands.add('startPlaybookRunWithSlashCommand', (playbookName, playbookRunName) => {
    cy.openPlaybookRunDialogFromSlashCommand();

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Selects Playbooks icon in the App Bar
Cypress.Commands.add('getPlaybooksAppBarIcon', () => {
    cy.get('#channel_view').should('be.visible');

    return cy.get('.app-bar').find('#app-bar-icon-playbooks');
});

// Starts playbook run from the playbook run RHS
Cypress.Commands.add('startPlaybookRunFromRHS', (playbookName, playbookRunName) => {
    cy.get('#channel-header').within(() => {
        // open flagged posts to ensure playbook run RHS is closed
        cy.get('#channelHeaderFlagButton').click();

        // open the playbook run RHS
        cy.getPlaybooksAppBarIcon().should('exist').click();
    });

    cy.get('#rhsContainer').should('exist').within(() => {
        cy.findByText('Run playbook').click();
    });

    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Create a new task from the RHS
Cypress.Commands.add('addNewTaskFromRHS', (taskname) => {
    // Click add new task
    cy.findByTestId('add-new-task-0').click();

    // Type a name
    cy.findByTestId('checklist-item-textarea-title').type(taskname);

    // Save task
    cy.findByTestId('checklist-item-save-button').click();
});

// Starts playbook run from the post menu
Cypress.Commands.add('startPlaybookRunFromPostMenu', (playbookName, playbookRunName) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type('new message here{enter}');

    // post a second message because cypress has trouble finding latest post when there's only one message
    cy.findByTestId('post_textbox').clear().type('another new message here{enter}');
    cy.clickPostActionsMenu();
    cy.findByRole('menuitem', {name: 'Run playbook'}).click();
    cy.startPlaybookRun(playbookName, playbookRunName);
});

// Create playbook
Cypress.Commands.add('createPlaybook', (teamName, playbookName) => {
    cy.visit('/playbooks/playbooks/new');

    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('exist');

    // # Type playbook name
    cy.get('#playbook-name .editable-trigger').click();
    cy.get('#playbook-name .editable-input').type(playbookName);
    cy.get('#playbook-name .editable-input').type('{enter}');

    // # Save playbook
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('not.be.disabled').click();
    cy.wait(TIMEOUTS.TWO_SEC);
    cy.findByTestId('save_playbook', {timeout: TIMEOUTS.HALF_MIN}).should('not.be.disabled').click();
});

// Select the playbook from the dropdown menu
Cypress.Commands.add('selectPlaybookFromDropdown', (playbookName) => {
    cy.findByTestId('playbookID').should('exist').within(() => {
        cy.get('input').click().type(playbookName.toLowerCase(), {force: true});
    });
    cy.document().its('body').find('#react-select-2-listbox').contains(playbookName).click({force: true});
});

Cypress.Commands.add('createPost', (message) => {
    // post a message as user to avoid system message
    cy.findByTestId('post_textbox').clear().type(`${message}{enter}`);
});

Cypress.Commands.add('addPostToTimelineUsingPostMenu', (playbookRunName, summary, postId) => {
    cy.clickPostDotMenu(postId);
    cy.findByTestId('playbookRunAddToTimeline').click();

    cy.get('#appsModal').should('exist').within(() => {
        // # Select playbook run
        cy.findByTestId('playbookID').should('exist').within(() => {
            cy.get('input').click().type(playbookRunName);
        });
        cy.document().its('body').find('#react-select-2-listbox').contains(playbookRunName).click({force: true});

        // # Type playbook run name
        cy.findByTestId('summaryinput').clear().type(summary, {force: true});

        // # Submit
        cy.get('#appsModalSubmit').click();
    });

    cy.get('#appsModal').should('not.exist');
});

Cypress.Commands.add('openSelector', () => {
    cy.findByText('Search for people').click({force: true});
});

Cypress.Commands.add('addInvitedUser', (userName) => {
    cy.get('.invite-users-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectOwner', (userName) => {
    cy.get('.assign-owner-selector__menu').within(() => {
        cy.findByText(userName).click({force: true});
    });
});

Cypress.Commands.add('selectChannel', (channelName) => {
    cy.get('#playbook-automation-broadcast .playbooks-rselect__menu').within(() => {
        cy.findByText(channelName).click({force: true});
    });
});

Cypress.Commands.add('openReminderSelector', () => {
    cy.get('#reminder_timer_datetime input').click({force: true});
});

Cypress.Commands.add('selectReminderTime', (timeText) => {
    cy.get('#reminder_timer_datetime .playbooks-rselect__menu').within(() => {
        cy.findByText(timeText).click({force: true});
    });
});

/**
 * Update the status of the current playbook run through the slash command.
 */
Cypress.Commands.add('updateStatus', (message, reminderQuery) => {
    // # Run the slash command to update status.
    cy.uiPostMessageQuickly('/playbook update');

    // # Get the interactive dialog modal.
    cy.getStatusUpdateDialog().within(() => {
        cy.wait(3 * TIMEOUTS.ONE_HUNDRED_MILLIS);

        // # remove what's there if applicable, and type the new update in the textbox.
        cy.findByTestId('update_run_status_textbox').clear().focus().realType(message);

        cy.wait(TIMEOUTS.ONE_HUNDRED_MILLIS);

        if (reminderQuery) {
            cy.get('#reminder_timer_datetime').within(() => {
                cy.get('#react-select-2-input').focus().realType(reminderQuery).wait(TIMEOUTS.ONE_SEC);
                cy.get('#react-select-2-input').focus().type('{enter}');
            });
        }

        // # Submit the dialog.
        cy.get('button.confirm').click();
    });

    // * Verify that the interactive dialog has gone.
    cy.getStatusUpdateDialog().should('not.exist');

    // # Return the post ID of the status update.
    return cy.getLastPostId();
});

/**
 * Edit a post through the post dot menu.
 * @param {String} postId - ID of the post to delete.
 * @param {String} newMessage - New content of the post.
 */
Cypress.Commands.add('editPost', (postId, newMessage) => {
    // # Open the post dot menu.
    cy.clickPostDotMenu(postId);

    // # Click on the Edit menu option.
    cy.get(`#edit_post_${postId}`).click();

    // # Overwrite the post content with the new message provided.
    cy.get('#edit_textbox').clear().type(newMessage);

    // # Confirm the edit in the dialog.
    cy.get('#editButton').click();
});

Cypress.Commands.add('getStatusUpdateDialog', () => {
    return cy.findByRole('dialog', {name: /post update/i});
});

Cypress.Commands.add('getStyledComponent', (className) => {
    cy.get(`[class^="${className}-"]`);
});

/**
 * Get the provided pseudo-class from the previous element and return the property passed as argument
 * @param {String} pseudoClass - CSS pseudo class to get.
 * @param {String} property - Property that will be returned.
 *
 * Stolen from https://stackoverflow.com/questions/55516990/cypress-testing-pseudo-css-class-before
 */
Cypress.Commands.add('cssPseudoClass', {prevSubject: 'element'}, (el, pseudoClass, property) => {
    const win = el[0].ownerDocument.defaultView;
    const pseudoElem = win.getComputedStyle(el[0], pseudoClass);
    return pseudoElem.getPropertyValue(property).replace(/(^")|("$)/g, '');
});

/**
 * Get the :before pseudo-class from the previous element and return the property passed as argument
 * @param {String} property - Property that will be returned.
 */
Cypress.Commands.add('before', {prevSubject: 'element'}, (el, property) => {
    return cy.wrap(el).cssPseudoClass('before', property);
});

/**
 * Get the :after pseudo-class from the previous element and return the property passed as argument
 * @param {String} property - Property that will be returned.
 */
Cypress.Commands.add('after', {prevSubject: 'element'}, (el, property) => {
    return cy.wrap(el).cssPseudoClass('after', property);
});

function waitUntilPermanentPost() {
    cy.get('#postListContent').should('exist');
    cy.waitUntil(() => cy.findAllByTestId('postView').last().then((el) => !(el[0].id.includes(':'))));
}

Cypress.Commands.add('getFirstPostId', () => {
    waitUntilPermanentPost();

    cy.findAllByTestId('postView').first().should('have.attr', 'id').and('not.include', ':').
        invoke('replace', 'post_', '');
});

Cypress.Commands.add('assertRunDetailsPageRenderComplete', (expectedRunOwner) => {
    // LHS uses position:fixed — use 'exist' to avoid Cypress 15 strict visibility checks
    cy.findByTestId('lhs-navigation').should('exist').within(() => {
        cy.contains('Playbooks').should('exist');
        cy.contains('Runs').should('exist');
    });
    cy.get('#playbooks-sidebar-right').should('be.visible').within(() => {
        cy.findByTestId('assignee-profile-selector').should('contain', expectedRunOwner);
        cy.findAllByTestId('timeline-item', {exact: false}).should('have.length.of.at.least', 1);
        cy.findAllByTestId('profile-option', {exact: false}).should('have.length.of.at.least', 1);
    });
});
