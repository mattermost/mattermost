// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function verifyDraftIcon(name, isVisible) {
    cy.uiGetLhsSection('CHANNELS').find(`#sidebarItem_${name}`).
        should('be.visible').
        findByTestId('lhs.channel_list.channel.draft--text').
        should(isVisible ? 'be.visible' : 'not.exist');
}
