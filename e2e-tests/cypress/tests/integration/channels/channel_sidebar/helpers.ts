// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

type ClickCategoryMenuItemProps = {
    categoryDisplayName: string;
    menuItemText: string;
    categoryMenuButtonName?: string;
    isSubMenu?: boolean;
}

export function clickCategoryMenuItem({categoryDisplayName, menuItemText, categoryMenuButtonName = categoryDisplayName, isSubMenu = false}: ClickCategoryMenuItemProps) {
    cy.get('#SidebarContainer').should('be.visible').within(() => {
        cy.findByText(categoryDisplayName).should('exist').parents('.SidebarChannelGroupHeader').within(() => {
            cy.findByLabelText(`${categoryMenuButtonName} category options`).should('exist').click({force: true});
        });
    });

    cy.wait(TIMEOUTS.HALF_SEC);

    cy.findByRole('menu', {name: 'Edit category menu'}).should('be.visible').within(() => {
        if (isSubMenu) {
            cy.findByText(menuItemText).should('exist').trigger('mouseover', {force: true});
        } else {
            cy.findByText(menuItemText).should('exist').click({force: true});
        }
    });
}

export function clickSortCategoryMenuItem(categoryDisplayName, menuItemText) {
    clickCategoryMenuItem({categoryDisplayName, menuItemText: 'Sort', isSubMenu: true});

    cy.wait(TIMEOUTS.HALF_SEC);

    cy.findAllByRole('menu', {name: 'Sort submenu'}).should('be.visible').within(() => {
        cy.findByText(menuItemText).should('exist').click({force: true});
    });
}
