// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @enterprise @system_console

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('System Console > Site Statistics', () => {
    let testTeam;

    const statDataTestIds = [
        'totalActiveUsers',
        'totalTeams',
        'totalChannels',
        'totalPosts',
        'totalSessions',
        'totalCommands',
        'incomingWebhooks',
        'outgoingWebhooks',
        'dailyActiveUsers',
        'monthlyActiveUsers',
        'websocketConns',
        'masterDbConns',
        'replicaDbConns'];

    const titleTestIds = [
        'totalActiveUsersTitle',
        'totalTeamsTitle',
        'totalChannelsTitle',
        'totalPostsTitle',
        'totalSessionsTitle',
        'totalCommandsTitle',
        'incomingWebhooksTitle',
        'outgoingWebhooksTitle',
        'dailyActiveUsersTitle',
        'monthlyActiveUsersTitle',
        'websocketConnsTitle',
        'masterDbConnsTitle',
        'replicaDbConnsTitle'];

    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();
    });

    afterEach(() => {
        // # Reset locale
        cy.apiPatchMe({locale: 'en'});
    });

    it('MM-T904 Site Statistics displays expected content categories', () => {
        cy.intercept('**/api/v4/**').as('resources');

        // # Visit site statistics page.
        cy.visit('/admin_console/reporting/system_analytics');
        cy.wait('@resources');

        // * Check that the header has loaded correctly and contains the expected text.
        cy.get('.admin-console__header span', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').should('contain', 'System Statistics');

        cy.wait(TIMEOUTS.ONE_SEC).waitUntil(() => cy.get('body').then((el) => {
            return !el[0].innerText.includes('Loading');
        }, {
            timeout: TIMEOUTS.ONE_MIN,
            interval: TIMEOUTS.FIVE_SEC,
            errorMsg: 'Timeout error waiting "Loading..." indicator message to disappear',
        }));

        // * Check that the rows for the table were generated.
        cy.get('.admin-console__content .row').should('have.length', 4);

        // * Check that the title content for the stats is as expected.
        cy.get('[data-testid="admin.statistics.stat:totalActiveUsers--group"] [data-testid="admin.statistics.stat.title--text"]').should('have.text', 'Total Activated Users');

        // cy.findByTestId('seatPurchasedTitle').should('contain', 'Total paid users');
        cy.get('[data-testid="admin.statistics.stat:totalTeams--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Total Teams');
        cy.get('[data-testid="admin.statistics.stat:totalChannels--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Total Channels');
        cy.get('[data-testid="admin.statistics.stat:totalPosts--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Total Posts');
        cy.get('[data-testid="admin.statistics.stat:totalSessions--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Total Sessions');
        cy.get('[data-testid="admin.statistics.stat:totalCommands--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Total Commands');
        cy.get('[data-testid="admin.statistics.stat:incomingWebhooks--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Incoming Webhooks');
        cy.get('[data-testid="admin.statistics.stat:outgoingWebhooks--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Outgoing Webhooks');
        cy.get('[data-testid="admin.statistics.stat:dailyActiveUsers--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Daily Active Users');
        cy.get('[data-testid="admin.statistics.stat:monthlyActiveUsers--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Monthly Active Users');
        cy.get('[data-testid="admin.statistics.stat:websocketConns--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'WebSocket Conns');
        cy.get('[data-testid="admin.statistics.stat:masterDbConns--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Master DB Conns');
        cy.get('[data-testid="admin.statistics.stat:replicaDbConns--group"] [data-testid="admin.statistics.stat.title--text"]').should('contain', 'Replica DB Conns');

        statDataTestIds.forEach((locator) => {
            cy.get(`[data-testid="admin.statistics.stat:${locator}--group"] [data-testid="admin.statistics.stat.value--text"]`).invoke('text').then(parseFloat).should('be.gte', 0);
        });
    });

    it('MM-T902 - Reporting ➜ Site statistics line graphs show same date', () => {
        cy.intercept('**/api/v4/**').as('resources');

        let newChannel;

        // # Create and visit new channel
        cy.apiInitSetup().then(({channel}) => {
            newChannel = channel;
        });

        // # Create a bot and get userID
        cy.apiCreateBot().then(({bot}) => {
            const botUserId = bot.user_id;
            cy.externalUpdateUserRoles(botUserId, 'system_user system_post_all system_admin');

            // # Get token from bots id
            cy.apiAccessToken(botUserId, 'Create token').then(({token}) => {
                //# Add bot to team
                cy.apiAddUserToTeam(newChannel.team_id, botUserId);

                const today = new Date();
                const yesterday = new Date(today);

                yesterday.setDate(yesterday.getDate() - 1);

                // # Post message as bot to the new channel
                cy.postBotMessage({token, channelId: newChannel.id, message: 'this is bot message', createAt: yesterday.getTime()}).then(() => {
                    cy.visit('/admin_console');
                    cy.wait('@resources');

                    cy.dbRefreshPostStats().then(() => {
                        // * Find site statistics and click it
                        cy.findByTestId('admin.sidebar.category.section:system_analytics--listitem', {timeout: TIMEOUTS.ONE_MIN}).findByTestId('admin.sidebar.category.section.title--link').click();

                        // * Expand the details
                        cy.findByTestId('admin.statistics.details', {timeout: TIMEOUTS.ONE_MIN}).click();

                        let totalPostsDataSet;
                        let totalPostsFromBots;
                        let activeUsersWithPosts;

                        // # Grab all data from the 3 charts from there data labels
                        cy.get('[data-testid="admin.statistics.chart:totalPostsLineChart--group"] [data-testid="admin.statistics.chart.canvas"]').then((el) => {
                            totalPostsDataSet = el[0].dataset.labels;
                            cy.get('[data-testid="admin.statistics.chart:totalPostsFromBotsLineChart--group"] [data-testid="admin.statistics.chart.canvas"]').then((el2) => {
                                totalPostsFromBots = el2[0].dataset.labels;
                                cy.get('[data-testid="admin.statistics.chart:activeUsersWithPostsLineChart--group"] [data-testid="admin.statistics.chart.canvas"]').then((el3) => {
                                    activeUsersWithPosts = el3[0].dataset.labels;

                                    // * Assert that all the dates are the same
                                    expect(totalPostsDataSet).equal(totalPostsFromBots);
                                    expect(totalPostsDataSet).equal(activeUsersWithPosts);
                                    expect(totalPostsFromBots).equal(activeUsersWithPosts);
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('MM-T905 - Site Statistics card labels in different languages', () => {
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Login as admin and set the language to french
            cy.apiAdminLogin();
            cy.visit(`/${testTeam.name}/channels/off-topic`);
            cy.uiOpenSettingsModal('Display').then(() => {
                cy.findByText('Language').click();
                cy.get('#displayLanguage').click();
                cy.findByText('Français (Beta)').click();
                cy.uiSave();
            });

            // * Once in site statistics, check and make sure the boxes are truncated or not according to image on test
            cy.visit('/admin_console/reporting/system_analytics');

            titleTestIds.forEach((id) => {
                let expectedResult = false;
                if (id === 'totalCommandsTitle' || id === 'masterDbConnsTitle' || id === 'replicaDbConnsTitle') {
                    expectedResult = true;
                }

                cy.get(`[data-testid="admin.statistics.stat:${id.replace('Title', '')}--group"] [data-testid="admin.statistics.stat.title--text"]`, {timeout: TIMEOUTS.ONE_MIN}).then((el) => {
                    const titleSpan = el[0].childNodes[0];

                    // * All the boxes on System Statistics page should have UNTRUNCATED titles when in french except Total Commands, Master DB Conns, and Replica DB Conns.
                    // * The following asserts if the they are truncated or not. If false, it means they are not truncated. If true, they are truncated.
                    expect(titleSpan.scrollWidth > titleSpan.clientWidth).equal(expectedResult);
                });
            });
        });
    });
});
