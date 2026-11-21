// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import accessRules from '@/fixtures/system-roles-console-access';
import disabledTests from '@/fixtures/console-example-inputs';
import * as TIMEOUTS from '@/fixtures/timeouts';

// A sidebar item is keyed by its sub-key: the section 'user_management.groups' is admin.sidebar.category.section:groups
function sidebarItemTestId(section) {
    return `admin.sidebar.category.section:${section.split('.').slice(1).join('.')}--listitem`;
}

function noAccessFunc(section) {
    // * If it's a no-access permission, we just need to check that the section doesn't exist in the side bar
    cy.findByTestId(sidebarItemTestId(section)).should('not.exist');
}

function readOnlyFunc(section) {
    // * If it's a read only permission, we need to make sure that the section does exist in the sidebar however the inputs in that section is disabled (read only)
    cy.findByTestId(sidebarItemTestId(section)).should('exist');
    checkInputsShould('be.disabled', section);
}

function readWriteFunc(section) {
    // * If we have read + write (can edit) permissions, we need to make the section exists and also that the inputs are all enabled
    cy.findByTestId(sidebarItemTestId(section)).should('exist');
    checkInputsShould('be.enabled', section);
}

function checkInputsShould(shouldString, section) {
    const {disabledInputs} = disabledTests.find((item) => item.section === section);
    Cypress._.forEach(disabledInputs, ({path, selector}) => {
        if (path.length && selector.length) {
            cy.visit(path, {timeout: TIMEOUTS.HALF_MIN});
            cy.get(selector, {timeout: TIMEOUTS.ONE_MIN}).should(shouldString);
        }
    });
}

export function makeUserASystemRole(testUsers, role) {
    // # Login as each new role.
    cy.apiAdminLogin();

    // # Go the system console.
    cy.visit('/admin_console/user_management/system_roles');

    cy.get('.admin-console__header').within(() => {
        cy.findByText('Delegated Granular Administration', {timeout: TIMEOUTS.ONE_MIN}).should('exist').and('be.visible');
    });

    // # Click on edit for the role
    cy.findByTestId(`admin.roles.row:${role}--row`).findByTestId('admin.roles.row.edit--link').click();

    // # Click Add People button
    cy.findByRole('button', {name: 'Add People'}).click().wait(TIMEOUTS.HALF_SEC);

    // # Type in user name
    cy.findByRole('combobox', {name: 'Search for people'}).typeWithForce(`${testUsers[role].email}`);

    // # Find the user and click on him
    cy.get('#multiSelectList').should('be.visible').children().first().click({force: true});

    // # Click add button
    cy.findByRole('button', {name: 'Add'}).click().wait(TIMEOUTS.HALF_SEC);

    // # Click save button
    cy.findByRole('button', {name: 'Save'}).click().wait(TIMEOUTS.HALF_SEC);
}

export function forEachConsoleSection(testUsers, roleName) {
    const ACCESS_NONE = 'none';
    const ACCESS_READ_ONLY = 'read';
    const ACCESS_READ_WRITE = 'read+write';

    const user = testUsers[roleName];

    // # Login as each new role.
    cy.apiLogin(user);

    // # Go the system console.
    cy.visit('/admin_console');
    cy.get('.admin-sidebar', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

    accessRules.forEach((rule) => {
        const {section} = rule;
        const access = rule[roleName];
        switch (access) {
        case ACCESS_NONE:
            noAccessFunc(section);
            break;
        case ACCESS_READ_ONLY:
            readOnlyFunc(section);
            break;
        case ACCESS_READ_WRITE:
            readWriteFunc(section);
            break;
        }
    });
}
