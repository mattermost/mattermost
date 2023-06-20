// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @cloud_only @cloud_trial

import {getAdminAccount} from '../../../../../support/env';

const admin = getAdminAccount();

interface Subscription{
    id: string;
    product_id: string;
    is_free_trial: string;
    trial_end_at: number;
}

interface Limits {
    messages?: { history: number };
    teams?: { active: number; teamsLoaded: boolean };
    files?: { total_storage: number };
}

function simulateFilesLimitReached(fileStorageUsageBytes: number) {
    cy.intercept('GET', '**/api/v4/usage/storage', {
        statusCode: 200,
        body: {
            bytes: fileStorageUsageBytes + 1, // increase workspace usage
        },
    });

    cy.intercept('GET', '**/api/v4/cloud/limits', {
        statusCode: 200,
        body: {
            files: {
                total_storage: fileStorageUsageBytes,
            },
        },
    });
}

// Move to utils
function simulateSubscription(subscription: Subscription, withLimits = {}) {
    cy.intercept('GET', '**/api/v4/cloud/subscription', {
        statusCode: 200,
        body: subscription,
    }).as('subscription');

    cy.intercept('GET', '**/api/v4/cloud/products**', {
        statusCode: 200,
        body: [
            {
                id: 'prod_1',
                sku: 'cloud-starter',
                price_per_seat: 0,
                name: 'Cloud Free',
            },
            {
                id: 'prod_2',
                sku: 'cloud-professional',
                price_per_seat: 10,
                name: 'Cloud Professional',
            },
            {
                id: 'prod_3',
                sku: 'cloud-enterprise',
                price_per_seat: 30,
                name: 'Cloud Enterprise',
            },
        ],
    }).as('products');

    if (withLimits) {
        cy.intercept('GET', '**/api/v4/cloud/limits', {
            statusCode: 200,
            body: withLimits,
        });
    }
}

function createUsersProcess(team: { id: string }, channel: { id: string }, times: number) {
    const users = [];
    for (let i = 0; i < times; i++) {
        cy.apiCreateUser({prefix: 'other'}).then(({user}) => {
            users.push(user);
            cy.apiAddUserToTeam(team.id, user.id).then(() => {
                cy.apiAddUserToChannel(channel.id, user.id);
            });
        });
    }

    return users;
}

function userGroupsNotification() {
    cy.get('#product_switch_menu').click().then((() => {
        cy.get('#mattermost_feature_custom_user_groups-restricted-indicator').click();
    }));

    cy.get('#FeatureRestrictedModal').should('exist');

    cy.get('#button-plans').click();

    cy.get('.close').click();
}

function creatNewTeamNotification() {
    cy.get('.test-team-header').click().then(() => {
        cy.get('#mattermost_feature_create_multiple_teams-restricted-indicator').click();
    });
    cy.get('#FeatureRestrictedModal').should('exist');
    cy.get('#button-plans').as('notifyButton').should('have.text', 'Notify admin').click();
    cy.get('@notifyButton').should('have.text', 'Admin notified!');
    cy.get('@notifyButton').click();
    cy.get('@notifyButton').should('have.text', 'Already notified!').should('be.disabled');
    cy.get('.close').click();
}

function createMessageLimitNotification() {
    cy.get('#product_switch_menu').click().then((() => {
        cy.get('#notify_admin_cta').click();
    }));
}

function createFilesNotificationForProfessionalFeatures() {
    cy.get('#product_switch_menu').click().then((() => {
        cy.findByText('Notify admin').should('be.visible').click();
        cy.findByText('Admin notified!').should('be.visible').click();
        cy.findByText('Already notified!').should('be.visible').should('be.disabled');
    }));
}

function createTrialNotificationForProfessionalFeatures() {
    cy.get('#product_switch_menu').click().then((() => {
        cy.get('#view_plans_cta').click();
        cy.get('#pricingModal').get('#professional').within(() => {
            cy.get('#notify_admin_cta').click();
        });
        cy.get('#closeIcon').click();
    }));
}

function createTrialNotificationForEnterpriseFeatures() {
    cy.get('#product_switch_menu').click().then((() => {
        cy.get('#view_plans_cta').click();
        cy.get('#pricingModal').get('#enterprise').within(() => {
            cy.get('#notify_admin_cta').click();
        });
        cy.get('#closeIcon').click();
    }));
}

function triggerNotifications(url, trial = false, _failOnStatusCode = true) {
    cy.apiAdminLogin().then(() => {
        cy.request({
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            method: 'POST',
            url: '/api/v4/users/trigger-notify-admin-posts',
            body: {
                trial_notification: trial,
            },
            failOnStatusCode: _failOnStatusCode,
        });
    });

    if (url) {
        cy.visit(url);
    }
}

function mapFeatureIdToId(id: string) {
    switch (id) {
    case 'mattermost.feature.custom_user_groups':
        return 'Custom User groups';
    case 'mattermost.feature.create_multiple_teams':
        return 'Create Multiple Teams';
    case 'mattermost.feature.unlimited_messages':
        return 'Unlimited Messages';
    case 'mattermost.feature.unlimited_file_storage':
        return 'Unlimited File Storage';
    case 'mattermost.feature.all_professional':
        return 'All Professional features';
    case 'mattermost.feature.all_enterprise':
        return 'All Enterprise features';
    default:
        return '';
    }
}
function deletePost() {
    // # Delete system-bot message
    cy.get('@postId').then((postId) => {
        cy.externalRequest({user: admin, method: 'DELETE', path: `posts/${postId}`});
    });
}
function assertNotification(featureId, minimumPlan, totalRequests, requestsCount, teamName, trial = false) {
    // # Open system-bot and admin DM
    cy.visit(`/${teamName}/messages/@system-bot`);

    // * Check for the post from the system-bot
    cy.getLastPostId().as('postId').then((postId) => {
        if (trial) {
            cy.get(`#${postId}_message`).then(() => {
                cy.get('a').contains('Enterprise trial');
            });
        } else {
            cy.get(`#${postId}_message`).contains(`${totalRequests} members of the workspace have requested a workspace upgrade for:`);
        }

        cy.get(`#${featureId}-title`.replaceAll('.', '_')).contains(mapFeatureIdToId(featureId));

        if (requestsCount >= 5) {
            cy.get(`#${featureId}-subtitle`.replaceAll('.', '_')).contains(`${requestsCount} members requested access to this feature`);
            cy.get(`#${postId}_at_sum_of_members_mention`).click().then(() => {
                cy.get('#notificationFromMembersModal');
                cy.get('#invitation_modal_title').contains(`Members that requested ${mapFeatureIdToId(featureId)}`).then(() => {
                    cy.get('.close').click();
                });
            });
        }

        if (minimumPlan === 'Professional plan') {
            cy.get(`#${featureId}-title`.replaceAll('.', '_')).within(() => {
                cy.get('#at_plan_mention').click();
            });

            cy.get('.PricingModal__header').should('exist').then(() => {
                cy.get('#closeIcon').click();
            });
        }
    });
}

function assertUpgradeMessageButton(onlyProfessionalFeatures?: boolean) {
    cy.get('#view_upgrade_options').contains('View upgrade options');
    cy.get('#view_upgrade_options').click();
    cy.get('#pricingModal').should('exist');

    if (onlyProfessionalFeatures) {
        cy.get('.close-x').click();
        cy.get('#upgrade_to_professional').contains('Upgrade to Professional');
        cy.get('.PurchaseModal').should('exist');
    }
}

function assertTrialMessageButton() {
    cy.get('#learn_more_about_trial').contains('Learn more about trial');
    cy.get('#learn_more_about_trial').click();
    cy.get('.LearnMoreTrialModal').should('exist').then(() => {
        cy.get('.close').click();
    });

    cy.findByText('View upgrade options').click();
    cy.get('#pricingModal').should('exist');
}

function testTrialNotifications(subscription, limits) {
    let myTeam;
    let myChannel;
    let myUrl: string;
    let myAllProfessionalUsers = [];
    let myAllEnterpriseUsers = [];
    const ALL_PROFESSIONAL_FEATURES_REQUESTS = 5;
    const ALL_ENTERPRISE_FEATURES_REQUESTS = 3;
    const TOTAL = 8;

    // # Login as an admin and create test users that will click the different notification ctas
    cy.apiInitSetup().then(({team, channel, offTopicUrl: url}) => {
        myTeam = team;
        myChannel = channel;
        myUrl = url;

        // # Create non admin users
        myAllProfessionalUsers = createUsersProcess(myTeam, myChannel, ALL_PROFESSIONAL_FEATURES_REQUESTS);
        myAllEnterpriseUsers = createUsersProcess(myTeam, myChannel, ALL_ENTERPRISE_FEATURES_REQUESTS);
    });

    // # Click notify admin to trial on pricing modal
    cy.then(() => {
        myAllProfessionalUsers.forEach((user) => {
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            cy.wait(['@subscription', '@products']);
            createTrialNotificationForProfessionalFeatures();
        });
    });

    // # Click notify admin to trial on pricing modal
    cy.then(() => {
        myAllEnterpriseUsers.forEach((user) => {
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            cy.wait(['@subscription', '@products']);
            createTrialNotificationForEnterpriseFeatures();
        });
    });

    cy.then(() => {
        // # Manually trigger saved notifications
        triggerNotifications(myUrl, true);
    });

    cy.then(() => {
        assertNotification('mattermost.feature.all_professional', 'Professional plan', TOTAL, ALL_PROFESSIONAL_FEATURES_REQUESTS, myTeam.name, true);
        assertNotification('mattermost.feature.all_enterprise', 'Enterprise plan', TOTAL, ALL_ENTERPRISE_FEATURES_REQUESTS, myTeam.name, true);
        assertTrialMessageButton();
    });

    deletePost();
}

function testFilesNotifications(subscription: Subscription, limits: Limits) {
    let myTeam;
    let myChannel;
    let myUrl;
    let myAllProfessionalUsers = [];
    const ALL_PROFESSIONAL_FEATURES_REQUESTS = 5;
    const TOTAL = 5;

    // # Login as an admin and create test users that will click the different notification ctas
    cy.apiInitSetup().then(({team, channel, offTopicUrl: url}) => {
        myTeam = team;
        myChannel = channel;
        myUrl = url;

        // # Create non admin users
        myAllProfessionalUsers = createUsersProcess(myTeam, myChannel, ALL_PROFESSIONAL_FEATURES_REQUESTS);
    });

    // # Click notify admin to trial on pricing modal
    cy.then(() => {
        myAllProfessionalUsers.forEach((user) => {
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            cy.wait(['@subscription', '@products']);
            createFilesNotificationForProfessionalFeatures();
        });
    });

    cy.then(() => {
        // # Manually trigger saved notifications
        triggerNotifications(myUrl, false);
    });

    cy.then(() => {
        assertNotification('mattermost.feature.unlimited_file_storage', 'Professional plan', TOTAL, ALL_PROFESSIONAL_FEATURES_REQUESTS, myTeam.name);
        assertUpgradeMessageButton();
    });
    deletePost();
}

function testUpgradeNotifications(subscription, limits) {
    let myTeam;
    let myChannel;
    let myUrl: string;
    let myMessageLimitUsers = [];
    let myUnlimitedTeamsUsers = [];
    let myUserGroupsUsers = [];

    const CREATE_MULTIPLE_TEAMS_USERS = 2;
    const UNLIMITED_MESSAGES_USERS = 3;
    const CUSTOM_USER_GROUPS = 5;

    // # Login as an admin and create test users that will click the different notification ctas
    cy.apiInitSetup().then(({team, channel, offTopicUrl: url}) => {
        myTeam = team;
        myChannel = channel;
        myUrl = url;

        // # Create non admin users
        myMessageLimitUsers = createUsersProcess(myTeam, myChannel, UNLIMITED_MESSAGES_USERS);
        myUnlimitedTeamsUsers = createUsersProcess(myTeam, myChannel, CREATE_MULTIPLE_TEAMS_USERS);
        myUserGroupsUsers = createUsersProcess(myTeam, myChannel, CUSTOM_USER_GROUPS);
    });

    // # Click notify admin on message limit reached
    cy.then(() => {
        myMessageLimitUsers.forEach((user) => {
            cy.clearCookies();
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            cy.wait(['@subscription', '@products']);
            createMessageLimitNotification();
        });
    });

    // # Click notify admin on team limit reached
    cy.then(() => {
        myUnlimitedTeamsUsers.forEach((user) => {
            cy.clearCookies();
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            cy.wait(['@subscription', '@products']);
            creatNewTeamNotification();
        });
    });

    // # Click notify admin to allow user groups creation
    cy.then(() => {
        myUserGroupsUsers.forEach((user) => {
            cy.clearCookies();
            simulateSubscription(subscription, limits);
            cy.apiLogin({...user, password: 'passwd'});
            cy.visit(`/${myTeam.name}/channels/${myChannel.name}`);
            userGroupsNotification();
        });
    });

    cy.then(() => {
        // # Manually trigger saved notifications
        triggerNotifications(myUrl, false);
    });

    cy.then(() => {
        assertNotification('mattermost.feature.custom_user_groups', 'Enterprise plan', 10, CUSTOM_USER_GROUPS, myTeam.name);
        assertNotification('mattermost.feature.create_multiple_teams', 'Professional plan', 10, CREATE_MULTIPLE_TEAMS_USERS, myTeam.name);
        assertNotification('mattermost.feature.unlimited_messages', 'Professional plan', 10, UNLIMITED_MESSAGES_USERS, myTeam.name);
        assertUpgradeMessageButton();
    });
    deletePost();
}

describe('Notify Admin', () => {
    before(() => {
        // * Check if server has license for Cloud
        cy.apiRequireLicenseForFeature('Cloud');
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableAPITriggerAdminNotifications: true,
            },
        });
    });

    beforeEach(() => {
        triggerNotifications('', false, false);
    });

    it('should test trial notifications', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 0, // never trialed before
        };

        cy.intercept('GET', '**/api/v4/usage/posts', {
            statusCode: 200,
            body: {
                count: 4500,
            },
        });
        const limits = {
            messages: {
                history: 8000,
            },
            teams: {
                active: 0,
                teamsLoaded: true,
            },
        };

        testTrialNotifications(subscription, limits);
    });

    it('should test files upgrade notifications', () => {
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
            trial_end_at: 0, // never trialed before
        };

        const fileStorageUsageBytes = 11000000000;

        const limits = {
            messages: {
                history: 7000, // test server seeded with around 4k messages
            },
            teams: {
                active: 0,
                teamsLoaded: true,
            },
            files: {
                total_storage: fileStorageUsageBytes,
            },
        };

        simulateFilesLimitReached(fileStorageUsageBytes);
        testFilesNotifications(subscription, limits);
    });

    it('should test upgrade notifications', () => {
        cy.intercept('GET', '**/api/v4/usage/posts', {
            statusCode: 200,
            body: {
                count: 7000,
            },
        });
        const subscription = {
            id: 'sub_test1',
            product_id: 'prod_1',
            is_free_trial: 'false',
        };

        const limits = {
            messages: {
                history: 7500,
            },
            teams: {
                active: 0, // no extra teams allowed to be created
                teamsLoaded: true,
            },
        };

        testUpgradeNotifications(subscription, limits);
    });
});
