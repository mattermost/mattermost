// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @auto_response @messaging

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Auto Response In DMs', () => {
    const AUTO_RESPONSE_MESSAGE = "I'm off today on PTO. I'll be back on Monday, October 13th.";
    const MESSAGES = ['Message1', 'Message2', 'Message3'];
    let userA;
    let userB;
    let testTeam;
    let offTopicUrl;

    before(() => {
        // # Enable ExperimentalEnableAutomaticReplies setting
        cy.apiUpdateConfig({TeamSettings: {ExperimentalEnableAutomaticReplies: true}});

        // # Create a new team
        cy.apiInitSetup().then((out) => {
            userA = out.user;
            testTeam = out.team;
            offTopicUrl = out.offTopicUrl;

            // # Create a second user
            cy.apiCreateUser().then(({user}) => {
                userB = user;
                cy.apiAddUserToTeam(testTeam.id, userB.id);
            });
        });
    });

    function enableAutoResponderForUserB() {
        // # Login as userB and enable automatic replies
        cy.apiLogin(userB);
        cy.apiPatchMe({
            notify_props: {
                ...userB.notify_props,
                auto_responder_active: 'true',
                auto_responder_message: AUTO_RESPONSE_MESSAGE,
            },
        });
        cy.apiLogout();
    }

    function openDmWithUserB() {
        // # Login as userA and open a DM with userB
        cy.apiLogin(userA);
        cy.visit(offTopicUrl);
        cy.uiAddDirectMessage().click();
        cy.get('#selectItems input').typeWithForce(userB.username);
        cy.findByText('Loading', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible');
        cy.findByText('Loading').should('not.exist');
        cy.get('#multiSelectList').findByText(`@${userB.username}`).click();
        cy.findByText('Go').click();
    }

    it('MM-T4004 Out-of-office automatic reply sends only one in a direct message within one calendar day', () => {
        enableAutoResponderForUserB();
        openDmWithUserB();

        // # Send direct message to userB
        cy.postMessage(MESSAGES[0]);

        // * Verify if auto response message in last post is displayed
        cy.getLastPostId().then((replyId) => {
            cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', AUTO_RESPONSE_MESSAGE);
        });

        // # Send another direct message to userB
        cy.postMessage(MESSAGES[1]);

        // * Verify if recent direct message and not the auto response in last post is displayed
        cy.getLastPostId().then((replyId) => {
            cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', MESSAGES[1]);
        });

        // # Send another direct message to userB
        cy.postMessage(MESSAGES[2]);

        // * Verify if recent direct message and not the auto response in last post is displayed
        cy.getLastPostId().then((replyId) => {
            cy.get(`#postMessageText_${replyId}`).should('be.visible').and('have.text', MESSAGES[2]);
        });
    });

    it('shows out-of-office notice above the DM composer with auto-reply tooltip', () => {
        enableAutoResponderForUserB();
        openDmWithUserB();

        // * Verify OOO notice is shown above the post input
        cy.findByTestId('outOfOfficeWarning').
            should('be.visible').
            and('contain.text', 'is Out of Office.');

        // * Verify off-hours notice is not shown alongside the OOO notice
        cy.get('.RemoteUserHour').should('not.exist');

        // * Wait until the auto-reply message is available (banner is focusable when tooltip is wrapped)
        cy.findByTestId('outOfOfficeWarning').should('have.attr', 'tabindex', '0');

        // # Focus the OOO banner (WithTooltip trigger; avoids Floating UI hover rest delay)
        cy.findByTestId('outOfOfficeWarning').focus();

        // * Verify tooltip shows the auto-reply message
        cy.get('.tooltipContainer', {timeout: TIMEOUTS.FIVE_SEC}).
            should('be.visible').
            and('contain.text', AUTO_RESPONSE_MESSAGE);
    });
});
