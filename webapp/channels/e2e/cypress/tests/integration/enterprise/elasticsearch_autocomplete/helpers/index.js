// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../../fixtures/timeouts';
import {getAdminAccount} from '../../../../support/env';

const admin = getAdminAccount();

function withTimestamp(string, timestamp) {
    return string + '-' + timestamp;
}

function createEmail(name, timestamp) {
    return name + timestamp + '@sample.mattermost.com';
}

// Helper function to start @mention
function startAtMention(string) {
    // # Get the expected input
    cy.get('@input').clear().type(string);

    // * Suggestion list should appear
    cy.get('#suggestionList').should('be.visible');
}

function searchForChannel(name) {
    // # Open up channel switcher
    cy.typeCmdOrCtrl().type('k').wait(TIMEOUTS.ONE_SEC);

    // # Clear out and type in the name
    cy.findByRole('textbox', {name: 'quick switch input'}).
        should('be.visible').
        as('input').
        clear().
        type(name);
}

function createChannel(channelType, teamId, userToAdd = null) {
    // # Create a channel as sysadmin
    return cy.externalRequest({
        user: admin,
        method: 'POST',
        path: 'channels',
        data: {
            team_id: teamId,
            name: 'test-channel' + Date.now(),
            display_name: 'Test Channel ' + Date.now(),
            type: channelType,
            header: '',
            purpose: '',
        },
    }).then(({data: channel}) => {
        if (userToAdd) {
            // # Get user profile by email
            return cy.apiGetUserByEmail(userToAdd.email).then(({user}) => {
                // # Add user to team
                cy.externalRequest({
                    user: admin,
                    method: 'post',
                    path: `channels/${channel.id}/members`,
                    data: {user_id: user.id},
                }).then(() => {
                    // # Explicitly wait to give some time to index before searching
                    cy.wait(TIMEOUTS.TWO_SEC);
                    return cy.wrap(channel);
                });
            });
        }

        // # Explicitly wait to give some time to index before searching
        cy.wait(TIMEOUTS.TWO_SEC);
        return cy.wrap(channel);
    });
}

export function createPrivateChannel(teamId, userToAdd = null) {
    // # Create a private channel as sysadmin
    return createChannel('P', teamId, userToAdd);
}

module.exports = {
    withTimestamp,
    createEmail,
    startAtMention,
    searchForChannel,
    enableElasticSearch: () => {
        // # Enable elastic search via the API
        cy.apiUpdateConfig({
            ElasticsearchSettings: {
                EnableAutocomplete: true,
                EnableIndexing: true,
                EnableSearching: true,
                Sniff: false,
            },
        });

        // # Navigate to the elastic search setting page
        cy.visit('/admin_console/environment/elasticsearch');

        // * Test the connection and verify that we are successful
        cy.contains('button', 'Test Connection').click();
        cy.get('.alert-success').should('have.text', 'Test successful. Configuration saved.');

        // # Index so we are up to date
        cy.contains('button', 'Index Now').click();

        // # Small wait to ensure new row is added
        cy.wait(TIMEOUTS.ONE_SEC).get('.job-table__table').find('tbody > tr').eq(0).as('firstRow');

        // * Newest row should eventually result in Success
        const checkFirstRow = () => {
            return cy.get('@firstRow').then((el) => {
                return el.find('.status-icon-success').length > 0;
            });
        };
        const options = {
            timeout: TIMEOUTS.TWO_MIN,
            interval: TIMEOUTS.TWO_SEC,
            errorMsg: 'Reindex did not succeed in time',
        };
        cy.waitUntil(checkFirstRow, options);
    },
    getTestUsers: () => {
        // Reverse the timestamp so that on search,
        // the newly created user will get on the list first.
        const reverseTimeStamp = (20 * Math.pow(10, 13)) - Date.now();
        return {
            ironman: {
                username: withTimestamp('ironman', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Tony',
                last_name: 'Stark',
                email: createEmail('ironman', reverseTimeStamp),
                nickname: withTimestamp('protoncannon', reverseTimeStamp),
            },
            hulk: {
                username: withTimestamp('hulk', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Bruce',
                last_name: 'Banner',
                email: createEmail('hulk', reverseTimeStamp),
                nickname: withTimestamp('gammaray', reverseTimeStamp),
            },
            hawkeye: {
                username: withTimestamp('hawkeye', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Clint',
                last_name: 'Barton',
                email: createEmail('hawkeye', reverseTimeStamp),
                nickname: withTimestamp('ronin', reverseTimeStamp),
            },
            deadpool: {
                username: withTimestamp('deadpool', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Wade',
                last_name: 'Wilson',
                email: createEmail('deadpool', reverseTimeStamp),
                nickname: withTimestamp('merc', reverseTimeStamp),
            },
            captainamerica: {
                username: withTimestamp('captainamerica', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Steve',
                last_name: 'Rogers',
                email: createEmail('captainamerica', reverseTimeStamp),
                nickname: withTimestamp('professional', reverseTimeStamp),
            },
            doctorstrange: {
                username: withTimestamp('doctorstrange', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Stephen',
                last_name: 'Strange',
                email: createEmail('doctorstrange', reverseTimeStamp),
                nickname: withTimestamp('sorcerersupreme', reverseTimeStamp),
            },
            thor: {
                username: withTimestamp('thor', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Thor',
                last_name: 'Odinson',
                email: createEmail('thor', reverseTimeStamp),
                nickname: withTimestamp('mjolnir', reverseTimeStamp),
            },
            loki: {
                username: withTimestamp('loki', reverseTimeStamp),
                password: 'passwd',
                first_name: 'Loki',
                last_name: 'Odinson',
                email: createEmail('loki', reverseTimeStamp),
                nickname: withTimestamp('trickster', reverseTimeStamp),
            },
            dot: {
                username: withTimestamp('dot.dot', reverseTimeStamp),
                password: 'passwd',
                first_name: 'z1First',
                last_name: 'z1Last',
                email: createEmail('dot', reverseTimeStamp),
                nickname: 'z1Nick',
            },
            dash: {
                username: withTimestamp('dash-dash', reverseTimeStamp),
                password: 'passwd',
                first_name: 'z2First',
                last_name: 'z2Last',
                email: createEmail('dash', reverseTimeStamp),
                nickname: 'z2Nick',
            },
            underscore: {
                username: withTimestamp('under_score', reverseTimeStamp),
                password: 'passwd',
                first_name: 'z3First',
                last_name: 'z3Last',
                email: createEmail('underscore', reverseTimeStamp),
                nickname: 'z3Nick',
            },
        };
    },
    createPrivateChannel: (teamId, userToAdd = null) => {
        // # Create a private channel as sysadmin
        return createChannel('P', teamId, userToAdd);
    },
    createPublicChannel: (teamId, userToAdd = null) => {
        // # Create a public channel as sysadmin
        return createChannel('O', teamId, userToAdd);
    },
    searchAndVerifyChannel: (channel, shouldExist = true) => {
        const name = channel.display_name;
        searchForChannel(name);

        if (shouldExist) {
            // * Channel should appear in suggestions list
            cy.get('#suggestionList').findByTestId(channel.name).should('be.visible');
        } else {
            // * Suggestion list and channel item should not appear
            cy.get('#suggestionList').should('not.exist');
            cy.findByTestId(channel.name).should('not.exist');
        }
    },
    searchAndVerifyUser: (user) => {
        // # Start @ mentions autocomplete with username
        cy.uiGetPostTextBox().
            as('input').
            clear().
            type(`@${user.username}`);

        // * Suggestion list should appear
        cy.get('#suggestionList', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible');

        // * Verify user appears in results post-change
        return cy.uiVerifyAtMentionSuggestion(user);
    },
};
