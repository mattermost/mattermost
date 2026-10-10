// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '../../types';

interface SetupResult {
    user: Cypress.UserProfile;
    team: Cypress.Team;
    channel: Cypress.Channel;
    channelUrl: string;
    offTopicUrl: string;
    townSquareUrl: string;
}
interface SetupParam {
    loginAfter?: boolean;
    promoteNewUserAsAdmin?: boolean;
    hideAdminTrialModal?: boolean;
    userPrefix?: string;
    userCreateAt?: number;
    teamPrefix?: {name: string; displayName: string};
    channelPrefix?: {name: string; displayName: string};
    skipBoardsWelcomePage?: boolean;
}
function apiInitSetup(arg: SetupParam = {}): ChainableT<SetupResult> {
    const {
        loginAfter = false,
        promoteNewUserAsAdmin = false,
        hideAdminTrialModal = true,
        userPrefix,
        userCreateAt,
        teamPrefix = {name: 'team', displayName: 'Team'},
        channelPrefix = {name: 'channel', displayName: 'Channel'},
        skipBoardsWelcomePage = true,
    } = arg;

    return (cy.apiCreateTeam(teamPrefix.name, teamPrefix.displayName) as any).then(({team}) => {
        // # Add public channel
        return (cy.apiCreateChannel(team.id, channelPrefix.name, channelPrefix.displayName) as any).then(({channel}) => {
            return (cy.apiCreateUser({prefix: userPrefix || (promoteNewUserAsAdmin ? 'admin' : 'user'), createAt: userCreateAt}) as any).then(({user}) => {
                if (promoteNewUserAsAdmin) {
                    (cy as any).apiPatchUserRoles(user.id, ['system_admin', 'system_user']);

                    // Only hide start trial modal for admin since it's not applicable to other users
                    cy.apiSaveStartTrialModal(user.id, hideAdminTrialModal.toString());
                }

                if (skipBoardsWelcomePage) {
                    cy.apiBoardsWelcomePageViewed(user.id);
                }

                return cy.apiAddUserToTeam(team.id, user.id).then(() => {
                    return cy.apiAddUserToChannel(channel.id, user.id).then(() => {
                        const getUrl = (channelName: string) => `/${team.name}/channels/${channelName}`;

                        const data = {
                            channel,
                            team,
                            user,
                            channelUrl: getUrl(channel.name),
                            offTopicUrl: getUrl('off-topic'),
                            townSquareUrl: getUrl('town-square'),
                        };

                        if (loginAfter) {
                            return cy.apiLogin(user).then(() => {
                                return cy.wrap(data);
                            });
                        }

                        return cy.wrap(data);
                    });
                });
            });
        });
    });
}

Cypress.Commands.add('apiInitSetup', apiInitSetup);

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {

            /**
             * Creates a new user and make it a member of the new public team and its channels - one public channel, town-square and off-topic.
             * Created user has an option to log in after all are setup.
             * Requires sysadmin session to initiate this command.
             * @param {boolean} options.loginAfter - false (default) or true if wants to login as the new user after setting up. Note that when true, succeeding API request will be limited to access/permission of a regular system user.
             * @param {boolean} options.promoteNewUserAsAdmin - false (default) or true if wants to promote the newly created user as sysadmin.
             * @param {boolean} options.hideAdminTrialModal - true (default) or false if wants to hide Start Enterprise Trial modal.
             * @param {string} options.userPrefix - 'user' (default) or any prefix to easily identify a user
             * @param {string} options.teamPrefix - {name: 'team', displayName: 'Team'} (default) or any prefix to easily identify a team
             * @param {string} options.channelPrefix - {name: 'team', displayName: 'Team'} (default) or any prefix to easily identify a channel
             * @returns {Object} `out` Cypress-chainable, yielded with element passed into .wrap().
             * @returns {Cypress.UserProfile} `out.user` as `UserProfile` object
             * @returns {Cypress.Team} `out.team` as `Team` object
             * @returns {Cypress.Channel} `out.channel` as `Channel` object
             * @returns {string} `out.channelUrl` as channel URL
             * @returns {string} `out.offTopicUrl` as off-topic URL
             * @returns {string} `out.townSquareUrl` as town-square URL
             *
             * @example
             *   let testUser;
             *   let testTeam;
             *   let testChannel;
             *   cy.apiInitSetup(options).then(({team, channel, user}) => {
             *       testUser = user;
             *       testTeam = team;
             *       testChannel = channel;
             *   });
             */
            apiInitSetup: typeof apiInitSetup;
        }
    }
}
