// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {getAdminAccount} from '../../../support/env';

export type SimpleUser = Pick<Cypress.UserProfile, 'username' | 'first_name' | 'last_name' | 'nickname' | 'password' | 'email'>;

function createPrivateChannel(teamId: string, userToAdd: Cypress.UserProfile = null) {
    // # Create a private channel as sysadmin
    return createChannel('P', teamId, userToAdd);
}

function createPublicChannel(teamId: string, userToAdd: Cypress.UserProfile = null) {
    // # Create a public channel as sysadmin
    return createChannel('O', teamId, userToAdd);
}

function createSearchData(prefix: string) {
    return cy.apiCreateCustomAdmin({loginAfter: true, hideAdminTrialModal: true}).then(({sysadmin}) => {
        const users = getTestUsers(prefix);

        cy.apiLogin(sysadmin);

        // # Create new team for tests
        return cy.apiCreateTeam('search', 'Search').then(({team}) => {
            // # Create pool of users for tests
            Cypress._.forEach(users, (testUser) => {
                cy.apiCreateUser({user: testUser}).then(({user}) => {
                    cy.apiAddUserToTeam(team.id, user.id);
                });
            });

            return cy.wrap({sysadmin, team, users});
        });
    });
}

function enableElasticSearch() {
    // # Enable elastic search via the API
    cy.apiUpdateConfig({
        ElasticsearchSettings: {
            EnableAutocomplete: true,
            EnableIndexing: true,
            EnableSearching: true,
            Sniff: false,
        },
    } as Cypress.AdminConfig);

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
}

function getTestUsers(prefix = ''): Record<string, SimpleUser> {
    if (Cypress.env('searchTestUsers')) {
        return JSON.parse(Cypress.env('searchTestUsers'));
    }

    return {
        ironman: generatePrefixedUser({
            username: 'ironman',
            first_name: 'Tony',
            last_name: 'Stark',
            nickname: 'protoncannon',
        }, prefix),
        hulk: generatePrefixedUser({
            username: 'hulk',
            first_name: 'Bruce',
            last_name: 'Banner',
            nickname: 'gammaray',
        }, prefix),
        hawkeye: generatePrefixedUser({
            username: 'hawkeye',
            first_name: 'Clint',
            last_name: 'Barton',
            nickname: 'ronin',
        }, prefix),
        deadpool: generatePrefixedUser({
            username: 'deadpool',
            first_name: 'Wade',
            last_name: 'Wilson',
            nickname: 'merc',
        }, prefix),
        captainamerica: generatePrefixedUser({
            username: 'captainamerica',
            first_name: 'Steve',
            last_name: 'Rogers',
            nickname: 'professional',
        }, prefix),
        doctorstrange: generatePrefixedUser({
            username: 'doctorstrange',
            first_name: 'Stephen',
            last_name: 'Strange',
            nickname: 'sorcerersupreme',
        }, prefix),
        thor: generatePrefixedUser({
            username: 'thor',
            first_name: 'Thor',
            last_name: 'Odinson',
            nickname: 'mjolnir',
        }, prefix),
        loki: generatePrefixedUser({
            username: 'loki',
            first_name: 'Loki',
            last_name: 'Odinson',
            nickname: 'trickster',
        }, prefix),
        dot: generatePrefixedUser({
            username: 'dot.dot',
            first_name: 'z1First',
            last_name: 'z1Last',
            nickname: 'z1Nick',
        }, prefix),
        dash: generatePrefixedUser({
            username: 'dash-dash',
            first_name: 'z2First',
            last_name: 'z2Last',
            nickname: 'z2Nick',
        }, prefix),
        underscore: generatePrefixedUser({
            username: 'under_score',
            first_name: 'z3First',
            last_name: 'z3Last',
            nickname: 'z3Nick',
        }, prefix),
    };
}

function getPostTextboxInput() {
    cy.wait(TIMEOUTS.HALF_SEC);
    cy.uiGetPostTextBox().
        as('input').
        clear();
}

function getQuickChannelSwitcherInput() {
    cy.findByRole('textbox', {name: 'quick switch input'}).
        should('be.visible').
        as('input').
        clear();
}

function searchAndVerifyChannel(channel: Cypress.Channel, shouldExist = true) {
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
}

function searchAndVerifyUser(user: Cypress.UserProfile) {
    // # Start @ mentions autocomplete with username
    cy.uiGetPostTextBox().
        as('input').
        clear().
        type(`@${user.username}`);

    // * Suggestion list should appear
    cy.get('#suggestionList', {timeout: TIMEOUTS.FIVE_SEC}).should('be.visible');

    // * Verify user appears in results post-change
    return cy.uiVerifyAtMentionSuggestion(user);
}

function searchForChannel(name: string) {
    // # Open up channel switcher
    cy.typeCmdOrCtrl().type('k').wait(TIMEOUTS.ONE_SEC);

    // # Clear out and type in the name
    cy.findByRole('textbox', {name: 'quick switch input'}).
        should('be.visible').
        as('input').
        clear().
        type(name);
}

function startAtMention(string: string) {
    // # Get the expected input
    cy.get('@input').clear().type(string);

    // * Suggestion list should appear
    cy.get('#suggestionList').should('be.visible');
}

function verifySuggestionAtPostTextbox(...expectedUsers: Cypress.UserProfile[]) {
    expectedUsers.forEach((user) => {
        cy.wait(TIMEOUTS.HALF_SEC);
        cy.uiVerifyAtMentionSuggestion(user);
    });
}

function verifySuggestionAtChannelSwitcher(...expectedUsers: Cypress.UserProfile[]) {
    expectedUsers.forEach((user) => {
        cy.findByTestId(user.username).
            should('be.visible').
            and('have.text', `${user.first_name} ${user.last_name} (${user.nickname})@${user.username}`);
    });
}

function createChannel(channelType: string, teamId: string, userToAdd: Cypress.UserProfile = null) {
    // # Create a channel as sysadmin
    return cy.externalRequest({
        user: getAdminAccount(),
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
                    user: getAdminAccount(),
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

function generatePrefixedUser(user: Omit<SimpleUser, 'password' | 'email'>, prefix: string) {
    return {
        username: withPrefix(user.username, prefix),
        password: 'passwd',
        first_name: withPrefix(user.first_name, prefix),
        last_name: withPrefix(user.last_name, prefix),
        email: createEmail(user.username, prefix),
        nickname: withPrefix(user.nickname, prefix),
    };
}

function withPrefix(name: string, prefix: string) {
    return prefix + name;
}

function createEmail(name: string, prefix: string) {
    return `${prefix}${name}@sample.mattermost.com`;
}

export {
    createPrivateChannel,
    createPublicChannel,
    createSearchData,
    enableElasticSearch,
    getTestUsers,
    getPostTextboxInput,
    getQuickChannelSwitcherInput,
    searchAndVerifyChannel,
    searchAndVerifyUser,
    searchForChannel,
    startAtMention,
    verifySuggestionAtChannelSwitcher,
    verifySuggestionAtPostTextbox,
};
