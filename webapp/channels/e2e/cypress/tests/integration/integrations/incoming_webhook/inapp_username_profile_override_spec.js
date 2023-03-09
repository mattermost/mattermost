// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @incoming_webhook

import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Incoming webhook', () => {
    const inAppUsername = 'in-app';
    const inAppIconURL = 'https://pbs.twimg.com/profile_images/3303520670/4da3468b30495a5d73e6f31df068e5c9.jpeg';

    let testTeam;
    let testChannel;
    let sysadmin;
    let incomingWebhook;

    before(() => {
        cy.apiGetMe().then(({user}) => {
            sysadmin = user;
        });

        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostUsernameOverride: true,
                EnablePostIconOverride: true,
            },
        });

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - in-app override',
                display_name: 'in-app-override',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;

                editIncomingWebhook(incomingWebhook.id, team.name, inAppUsername, inAppIconURL);
            });
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T620 Payload username and profile picture override in-app settings', () => {
        // # Post an incoming webhook with username and profile icon URL
        const payload = getPayload(testChannel, true);
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        // # Click test channel on sidebar
        cy.get(`#sidebarItem_${testChannel.name}`).should('be.visible').click({force: true});

        // # Wait for the webhook message to get posted
        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(payload.text));
        }));

        // * Verify that the username and profile icon are overridden per webhook payload
        verifyLastPost(sysadmin, payload.username, payload.icon_url);
    });

    it('MM-T621 Override username and profile picture - remove overrides from payload', () => {
        // # Post an incoming webhook without username and profile icon URL
        const payload = getPayload(testChannel, false);
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        // # Click test channel on sidebar
        cy.get(`#sidebarItem_${testChannel.name}`).should('be.visible').click({force: true});

        // # Wait for the webhook message to get posted
        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(payload.text));
        }));

        // * Verify that the username and profile icon are based from webhook settings
        verifyLastPost(sysadmin, inAppUsername, inAppIconURL);
    });
});

function editIncomingWebhook(incomingWebhookId, teamName, inAppUsername, inAppIconURL) {
    // # Edit incoming webhook
    cy.visit(`/${teamName}/integrations/incoming_webhooks/edit?id=${incomingWebhookId}`);
    cy.get('.backstage-header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').within(() => {
        cy.findByText('Incoming Webhooks').should('be.visible');
        cy.findByText('Edit').should('be.visible');
    });

    // # Enter username and profile icon URL
    cy.findByLabelText('Username').should('exist').type(inAppUsername);
    cy.findByLabelText('Profile Picture').should('exist').type(inAppIconURL);

    // # Click update and verify it redirects to incoming webhook page
    cy.findByText('Update').click();
    cy.url().should('include', `/${teamName}/integrations/incoming_webhooks`).wait(TIMEOUTS.ONE_SEC);
}

function getPayload(channel, withUsernameAndProfileIcon) {
    const payload = {
        channel: channel.name,
        text: `${getRandomId()} - this is from incoming webhook`,
    };

    if (!withUsernameAndProfileIcon) {
        return payload;
    }

    return {
        ...payload,
        username: 'payload_username',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
    };
}

function verifyLastPost(owner, username, iconUrl) {
    cy.getLastPost().within(() => {
        // * Verify username in post header
        cy.get('.post__header').find('.user-popover').as('usernameForPopover').should('have.text', username);

        // * Verify profile icon in post header
        const baseUrl = Cypress.config('baseUrl');
        const encodedIconUrl = encodeURIComponent(iconUrl);
        cy.get('.profile-icon > img').as('profileIconForPopover').should('have.attr', 'src', `${baseUrl}/api/v4/image?url=${encodedIconUrl}`);

        // * Verify that the BOT label appears
        cy.get('.Tag').should('be.visible').and('have.text', 'BOT');

        // * Verify that there's no status indicator
        cy.get('.status').should('not.exist');
    });

    // # Click on username and verify profile popover
    cy.get('@usernameForPopover').click();
    verifyProfilePopover(owner, username, iconUrl);

    // # Press escape key to close profile popover
    cy.get('body').typeWithForce('{esc}');

    // # Click on profile icon and verify profile popover
    cy.get('@profileIconForPopover').click();
    verifyProfilePopover(owner, username, iconUrl);
}

function verifyProfilePopover(owner, username, iconUrl) {
    // * Verify that the profile popover is shown
    cy.get('#user-profile-popover').should('be.visible').within(() => {
        // * Verify username from payload
        cy.get('.user-profile-popover__heading').should('be.visible').and('have.text', username);

        // * Verify icon URL from payload
        cy.get('.Avatar').should('have.attr', 'src', iconUrl);

        // * Verify that it matches with correct footer
        cy.get('.popover__row').should('be.visible').and('have.text', `This post was created by an integration from @${owner.username}`);
    });
}
