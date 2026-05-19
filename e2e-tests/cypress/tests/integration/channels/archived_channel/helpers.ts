// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '@/fixtures/timeouts';

export function createArchivedChannel(channelOptions: Record<string, unknown>, messages: string[], memberUsernames?: string[]) {
    return cy.uiCreateChannel(channelOptions).then((newChannel) => {
        if (memberUsernames) {
            cy.uiAddUsersToCurrentChannel(memberUsernames);
        }

        messages.forEach((message) => {
            cy.postMessage(message);
        });

        cy.uiArchiveChannel();

        // # Wait for sometime and verify that the archived message is shown
        cy.wait(TIMEOUTS.FIVE_SEC);
        cy.get('#channelArchivedMessage', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        return cy.wrap({name: newChannel.name});
    });
}
