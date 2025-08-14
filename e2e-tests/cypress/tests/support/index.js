// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***********************************************************
// Read more at: https://on.cypress.io/configuration
// ***********************************************************

/* eslint-disable no-loop-func */

import dayjs from 'dayjs';
import localforage from 'localforage';

import '@testing-library/cypress/add-commands';
import 'cypress-file-upload';
import 'cypress-wait-until';
import 'cypress-plugin-tab';
import 'cypress-real-events';
import addContext from 'mochawesome/addContext';

import './api';
import './api_commands'; // soon to deprecate
import './client';
import './common_login_commands';
import './db_commands';
import './email';
import './external_commands';
import './extended_commands';
import './fetch_commands';
import './keycloak_commands';
import './ldap_commands';
import './ldap_server_commands';
import './notification_commands';
import './okta_commands';
import './saml_commands';
import './shell';
import './task_commands';
import './ui';
import './ui_commands'; // soon to deprecate
import {DEFAULT_TEAM} from './constants';

import {getDefaultConfig} from './api/system';
import {E2EClient} from './client-impl';
import {getAdminAccount} from './env';
import {createTeamPatch} from './api/team';

Cypress.dayjs = dayjs;

Cypress.on('test:after:run', (test, runnable) => {
    // Only if the test is failed do we want to add
    // the additional context of the screenshot.
    if (test.state === 'failed') {
        let parentNames = '';

        // Define our starting parent
        let parent = runnable.parent;

        // If the test failed due to a hook, we have to handle
        // getting our starting parent to form the correct filename.
        if (test.failedFromHookId) {
            // Failed from hook Id is always something like 'h2'
            // We just need the trailing number to match with parent id
            const hookId = test.failedFromHookId.split('')[1];

            // If the current parentId does not match our hook id
            // start digging upwards until we get the parent that
            // has the same hook id, or until we get to a tile of ''
            // (which means we are at the top level)
            if (parent.id !== `r${hookId}`) {
                while (parent.parent && parent.parent.id !== `r${hookId}`) {
                    if (parent.title === '') {
                        // If we have a title of '' we have reached the top parent
                        break;
                    } else {
                        parent = parent.parent;
                    }
                }
            }
        }

        // Now we can go from parent to parent to generate the screenshot filename
        while (parent) {
            // Only append parents that have actual content for their titles
            if (parent.title !== '') {
                parentNames = parent.title + ' -- ' + parentNames;
            }

            parent = parent.parent;
        }

        // Clean up strings of characters that Cypress strips out
        const charactersToStrip = /[;:"<>/]/g;
        parentNames = parentNames.replace(charactersToStrip, '');
        const testTitle = test.title.replace(charactersToStrip, '');

        // If the test has a hook name, that means it failed due to a hook
        // and consequently Cypress appends some text to the file name
        const hookName = test.hookName ? ' -- ' + test.hookName + ' hook' : '';

        const filename = encodeURIComponent(`${parentNames}${testTitle}${hookName} (failed).png`);

        // Add context to the mochawesome report which includes the screenshot
        addContext({test}, {
            title: 'Failing Screenshot: >> screenshots/' + Cypress.spec.name + '/' + filename,
            value: 'screenshots/' + Cypress.spec.name + '/' + filename,
        });
    }
});

// Turn off all uncaught exception handling
Cypress.on('uncaught:exception', () => {
    return false;
});

before(() => {
    // # Clear localforage state
    localforage.clear();

    cy.makeClient().then(async ({user, client}) => {
        if (!user) {
            const firstClient = new E2EClient();
            firstClient.setUrl(Cypress.config('baseUrl'));
            const defaultAdmin = getAdminAccount();
            const createdUser = await firstClient.createUser(defaultAdmin, '', '');
            expect(createdUser).to.have.property('id');

            return cy.makeClient();
        }

        return cy.wrap({user, client});
    }).then(async ({client: adminClient, user: adminUser}) => {
        // Update server config
        const config = await adminClient.updateConfig(getDefaultConfig());
        const configOldFormat = await adminClient.getClientConfigOld();

        // Create default team if it does not exist
        await createDefaultTeam(adminClient);

        // Set default preferences
        await savePreferences(adminClient, adminUser?.id ?? '');

        // Get all plugins
        const plugins = await adminClient.getPlugins();

        // Get license information
        const license = await adminClient.getClientLicenseOld();

        cy.wrap({adminUser, config, configOldFormat, license, plugins});
    }).then(({config, configOldFormat, license, adminUser, plugins}) => {
        cy.log('---');

        cy.log(`config: ${JSON.stringify(config)}`);
        cy.log(`configOldFormat: ${JSON.stringify(configOldFormat)}`);

        // Print license information
        printLicenseInfo(license);

        // Print server information
        printServerInfo(config, configOldFormat);

        // Log plugin details
        printPluginDetails(plugins);

        // Print admin user information
        printAdminInfo(adminUser);

        // Print Cypress test configuration
        printCypressTestConfig();

        cy.log('---\n');
    });
});

beforeEach(() => {
    // Temporary fix for error related to this.get('prev') being undefined with @testing-library/cypress@9.0.0
    cy.then(() => null);
});

async function createDefaultTeam(adminClient) {
    const myTeams = await adminClient.getMyTeams();
    const myDefaultTeam = myTeams && myTeams.length > 0 && myTeams.find((team) => team.name === DEFAULT_TEAM.name);
    if (!myDefaultTeam) {
        await adminClient.createTeam(createTeamPatch(DEFAULT_TEAM.name, DEFAULT_TEAM.display_name, 'O', false));
    } else if (myDefaultTeam && Cypress.env('resetBeforeTest')) {
        await Promise.all(
            myTeams.filter((team) => team.name !== myDefaultTeam.name).map((team) => adminClient.deleteTeam(team.id)),
        );

        const myChannels = await adminClient.getMyChannels(myDefaultTeam.id);
        await Promise.all(
            myChannels.filter((channel) => {
                return (
                    channel.team_id === myDefaultTeam.id &&
                    channel.name !== 'town-square' &&
                    channel.name !== 'off-topic'
                );
            }).map((channel) => adminClient.deleteChannel(channel.id)),
        );
    }
}

async function savePreferences(adminClient, userId) {
    if (!userId) {
        throw new Error('userId is not defined');
    }

    const preferences = [
        {user_id: userId, category: 'tutorial_step', name: userId, value: '999'},
        {user_id: userId, category: 'crt_thread_pane_step', name: userId, value: '999'},
    ];

    await adminClient.savePreferences(userId, preferences);
}

function printPluginDetails(plugins) {
    let logs = '';

    if (plugins.active.length) {
        // eslint-disable-next-line no-console
        logs += 'Active plugins:';
    }

    plugins.active.forEach((plugin) => {
        // eslint-disable-next-line no-console
        logs += `\n  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`;
    });

    if (plugins.inactive.length) {
        // eslint-disable-next-line no-console
        logs += '\nInactive plugins:';
    }

    plugins.inactive.forEach((plugin) => {
        // eslint-disable-next-line no-console
        logs += `\n  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`;
    });

    // eslint-disable-next-line no-console
    cy.log(logs);
}

function printCypressTestConfig() {
    if (Cypress.env('ci')) {
        // eslint-disable-next-line no-console
        cy.log(`Cypress Test Config:
  - Browser     = ${Cypress.browser.name} v${Cypress.browser.version}
  - Viewport    = ${Cypress.config('viewportWidth')}x${Cypress.config('viewportHeight')}
  - BaseUrl     = ${Cypress.config('baseUrl')}`);
    }
}

function printLicenseInfo(license) {
    // eslint-disable-next-line no-console
    cy.log(`Server License:
  - IsLicensed      = ${license.IsLicensed}
  - IsTrial         = ${license.IsTrial}
  - SkuName         = ${license.SkuName}
  - SkuShortName    = ${license.SkuShortName}
  - Cloud           = ${license.Cloud}
  - Users           = ${license.Users}`);
}

function printServerInfo(config, configOldFormat) {
    // eslint-disable-next-line no-console
    cy.log(`Build Info:
  - BuildNumber                 = ${configOldFormat.BuildNumber}
  - BuildDate                   = ${configOldFormat.BuildDate}
  - Version                     = ${configOldFormat.Version}
  - BuildHash                   = ${configOldFormat.BuildHash}
  - BuildHashEnterprise         = ${configOldFormat.BuildHashEnterprise}
  - BuildEnterpriseReady        = ${configOldFormat.BuildEnterpriseReady}
  - TelemetryId                 = ${configOldFormat.TelemetryId}
  - ServiceEnvironment          = ${configOldFormat.ServiceEnvironment}`);

    if (Cypress.env('ci')) {
        // eslint-disable-next-line no-console
        cy.log(`Notable Server Config:
  - ServiceSettings.EnableSecurityFixAlert  = ${config.ServiceSettings?.EnableSecurityFixAlert}
  - LogSettings.EnableDiagnostics           = ${config.LogSettings?.EnableDiagnostics}`);

        // eslint-disable-next-line no-console
        cy.log('Feature Flags:');
        Object.entries(config.FeatureFlags).forEach(([key, value]) => cy.log(`  - ${key} = ${value}`));

        cy.log(`Plugin Settings:
  - Enable                       = ${config.PluginSettings?.Enable}
  - EnableUploads                = ${config.PluginSettings?.EnableUploads}
  - AutomaticPrepackagedPlugins  = ${config.PluginSettings?.AutomaticPrepackagedPlugins}`);
    }
}

function printAdminInfo(adminUser) {
    if (Cypress.env('ci')) {
        // eslint-disable-next-line no-console
        cy.log(`Admin Info:
  - ID          = ${adminUser.id}
  - Username    = ${adminUser.username}
  - FirstName   = ${adminUser.first_name}
  - LastName    = ${adminUser.last_name}
  - Email       = ${adminUser.email}
  - Locale      = ${adminUser.locale}
  - Timezone    = ${JSON.stringify(adminUser.timezone)}
  - Roles       = ${JSON.stringify(adminUser.roles)}`);
    }
}
