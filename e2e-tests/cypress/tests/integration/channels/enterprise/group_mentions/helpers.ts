// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '@/fixtures/timeouts';

export function enableGroupMention(groupName: string, groupID: string, userEmail?: string): void {
    // # Visit Group Configurations page
    cy.visit(`/admin_console/user_management/groups/${groupID}`);

    // # Scroll users list into view and then make sure it has loaded before scrolling back to the top
    cy.get('#group_users', {timeout: TIMEOUTS.ONE_MIN}).scrollIntoView();
    if (userEmail) {
        cy.findByText(userEmail).should('be.visible');
    }
    cy.get('#group_profile').scrollIntoView().wait(TIMEOUTS.TWO_SEC);

    // # Enable group mentions if not already on
    cy.findByTestId('allowReferenceSwitch-button').then(($input) => {
        if (!$input.prop('checked')) {
            cy.wrap($input).click({force: true});
        }
    });

    // # Give the group a custom name different from its DisplayName attribute
    cy.get('#groupMention').find('input').clear().type(groupName);

    // # Click save button
    cy.uiSaveConfig();
}
