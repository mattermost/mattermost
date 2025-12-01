// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***********************************************************
// Read more at: https://on.cypress.io/configuration
// ***********************************************************



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
    cy.log('>>> [DEBUG] before() hook STARTED');
    cy.log(`>>> [DEBUG] baseUrl: ${Cypress.config('baseUrl')}`);
    cy.log(`>>> [DEBUG] serverEdition: ${Cypress.env('serverEdition')}`);
    cy.log(`>>> [DEBUG] serverClusterEnabled: ${Cypress.env('serverClusterEnabled')}`);

    // # Clear localforage state
    cy.log('>>> [DEBUG] Clearing localforage...');
    localforage.clear();
    cy.log('>>> [DEBUG] localforage cleared');

    // # Try to login using existing sysadmin account
    cy.log('>>> [DEBUG] Attempting apiAdminLogin...');
    cy.apiAdminLogin({failOnStatusCode: false}).then((response) => {
        cy.log(`>>> [DEBUG] apiAdminLogin response received, user exists: ${!!response.user}`);
        if (response.user) {
            cy.log(`>>> [DEBUG] User found: ${response.user.username}, calling sysadminSetup...`);
            sysadminSetup(response.user);
        } else {
            cy.log('>>> [DEBUG] No user found, creating admin...');
            // # Create and login a newly created user as sysadmin
            cy.apiCreateAdmin().then(({sysadmin}) => {
                cy.log(`>>> [DEBUG] Admin created: ${sysadmin.username}, logging in...`);
                cy.apiAdminLogin().then(() => {
                    cy.log('>>> [DEBUG] Admin login successful, calling sysadminSetup...');
                    sysadminSetup(sysadmin);
                });
            });
        }

        cy.log(`>>> [DEBUG] Checking serverEdition: ${Cypress.env('serverEdition')}`);
        switch (Cypress.env('serverEdition')) {
        case 'Cloud':
            cy.log('>>> [DEBUG] Requiring Cloud license...');
            cy.apiRequireLicenseForFeature('Cloud');
            break;
        case 'E20':
            cy.log('>>> [DEBUG] Requiring E20 license...');
            cy.apiRequireLicense();
            break;
        default:
            cy.log('>>> [DEBUG] No special license required (Team edition)');
            break;
        }

        if (Cypress.env('serverClusterEnabled')) {
            cy.log('>>> [DEBUG] Checking cluster information...');

            // * Ensure cluster is set up properly when enabled
            cy.shouldHaveClusterEnabled();
            cy.apiGetClusterStatus().then(({clusterInfo}) => {
                const sameCount = clusterInfo?.length === Cypress.env('serverClusterHostCount');
                expect(sameCount, sameCount ? '' : `Should match number of hosts in a cluster as expected. Got "${clusterInfo?.length}" but expected "${Cypress.env('serverClusterHostCount')}"`).to.equal(true);

                clusterInfo.forEach((info) => cy.log(`hostname: ${info.hostname}, version: ${info.version}, config_hash: ${info.config_hash}`));
            });
        } else {
            cy.log('>>> [DEBUG] Cluster check skipped (not enabled)');
        }

        // Log license status and server details before test
        cy.log('>>> [DEBUG] Printing license status...');
        printLicenseStatus();
        cy.log('>>> [DEBUG] Printing server details...');
        printServerDetails();
        cy.log('>>> [DEBUG] before() hook COMPLETED');
    });
});

beforeEach(() => {
    // Temporary fix for error related to this.get('prev') being undefined with @testing-library/cypress@9.0.0
    cy.then(() => null);
});

function printLicenseStatus() {
    cy.apiGetClientLicense().then(({license}) => {
        cy.log(`Server License:
  - IsLicensed      = ${license.IsLicensed}
  - IsTrial         = ${license.IsTrial}
  - SkuName         = ${license.SkuName}
  - SkuShortName    = ${license.SkuShortName}
  - Cloud           = ${license.Cloud}
  - Users           = ${license.Users}`);
    });
}

function printServerDetails() {
    cy.apiGetConfig(true).then(({config}) => {
        cy.log(`Build Info:
  - BuildNumber             = ${config.BuildNumber}
  - BuildDate               = ${config.BuildDate}
  - Version                 = ${config.Version}
  - BuildHash               = ${config.BuildHash}
  - BuildHashEnterprise     = ${config.BuildHashEnterprise}
  - BuildEnterpriseReady    = ${config.BuildEnterpriseReady}
  - TelemetryId             = ${config.TelemetryId}
  - ServiceEnvironment      = ${config.ServiceEnvironment}`);
    });
    cy.apiGetConfig().then(({config}) => {
        cy.log(`Notable Server Config:
  - ServiceSettings.EnableSecurityFixAlert  = ${config.ServiceSettings.EnableSecurityFixAlert}
  - LogSettings.EnableDiagnostics           = ${config.LogSettings?.EnableDiagnostics}`);
    });
}

function sysadminSetup(user) {
    cy.log(`>>> [DEBUG] sysadminSetup STARTED for user: ${user.username}`);
    cy.log(`>>> [DEBUG] firstTest env: ${Cypress.env('firstTest')}`);

    if (Cypress.env('firstTest')) {
        cy.log('>>> [DEBUG] firstTest=true, sending dummy config request...');
        // Sends dummy call to update the config to server
        // Without this, first call to `cy.apiUpdateConfig()` consistently getting time out error in CI against remote server.
        cy.externalRequest({user, method: 'put', path: 'config', data: getDefaultConfig(), failOnStatusCode: false});
        cy.log('>>> [DEBUG] dummy config request completed');
    }

    // # Reset config to default
    cy.log('>>> [DEBUG] Calling apiUpdateConfig...');
    cy.apiUpdateConfig();
    cy.log('>>> [DEBUG] apiUpdateConfig completed');

    if (!user.email_verified) {
        cy.log('>>> [DEBUG] Verifying user email...');
        cy.apiVerifyUserEmailById(user.id);
        cy.log('>>> [DEBUG] Email verified');
    }

    // # Reset admin preference, online status and locale
    cy.log('>>> [DEBUG] Resetting user preferences...');
    resetUserPreference(user.id);
    cy.log('>>> [DEBUG] Preferences reset, updating status to online...');
    cy.apiUpdateUserStatus('online');
    cy.log('>>> [DEBUG] Status updated, patching locale/timezone...');
    cy.apiPatchMe({
        locale: 'en',
        timezone: {automaticTimezone: '', manualTimezone: 'UTC', useAutomaticTimezone: 'false'},
    });
    cy.log('>>> [DEBUG] Locale/timezone patched');

    // # Reset roles
    cy.log('>>> [DEBUG] Checking license for role reset...');
    cy.apiGetClientLicense().then(({isLicensed}) => {
        cy.log(`>>> [DEBUG] isLicensed: ${isLicensed}`);
        if (isLicensed) {
            cy.log('>>> [DEBUG] Resetting roles...');
            cy.apiResetRoles();
            cy.log('>>> [DEBUG] Roles reset');
        }
    });

    // # Disable plugins not included in prepackaged
    cy.log('>>> [DEBUG] Disabling non-prepackaged plugins...');
    cy.apiDisableNonPrepackagedPlugins();
    cy.log('>>> [DEBUG] Plugins disabled');

    // # Deactivate test bots if any
    cy.log('>>> [DEBUG] Deactivating test bots...');
    cy.apiDeactivateTestBots();
    cy.log('>>> [DEBUG] Bots deactivated');

    // # Disable welcome tours if any
    cy.log('>>> [DEBUG] Disabling tutorials...');
    cy.apiDisableTutorials(user.id);
    cy.log('>>> [DEBUG] Tutorials disabled');

    // # Check if default team is present; create if not found.
    cy.log('>>> [DEBUG] Getting teams for user...');
    cy.apiGetTeamsForUser().then(({teams}) => {
        cy.log(`>>> [DEBUG] Found ${teams?.length || 0} teams`);
        const defaultTeam = teams && teams.length > 0 && teams.find((team) => team.name === DEFAULT_TEAM.name);

        if (!defaultTeam) {
            cy.log(`>>> [DEBUG] Default team not found, creating ${DEFAULT_TEAM.name}...`);
            cy.apiCreateTeam(DEFAULT_TEAM.name, DEFAULT_TEAM.display_name, 'O', false);
            cy.log('>>> [DEBUG] Default team created');
        } else if (defaultTeam && Cypress.env('resetBeforeTest')) {
            cy.log(`>>> [DEBUG] resetBeforeTest=true, cleaning up teams...`);
            teams.forEach((team) => {
                if (team.name !== DEFAULT_TEAM.name) {
                    cy.log(`>>> [DEBUG] Deleting team: ${team.name}`);
                    cy.apiDeleteTeam(team.id);
                }
            });

            cy.log('>>> [DEBUG] Getting channels for cleanup...');
            cy.apiGetChannelsForUser('me', defaultTeam.id).then(({channels}) => {
                cy.log(`>>> [DEBUG] Found ${channels?.length || 0} channels`);
                channels.forEach((channel) => {
                    if (
                        (channel.team_id === defaultTeam.id || channel.team_name === defaultTeam.name) &&
                        (channel.name !== 'town-square' && channel.name !== 'off-topic')
                    ) {
                        cy.log(`>>> [DEBUG] Deleting channel: ${channel.name}`);
                        cy.apiDeleteChannel(channel.id);
                    }
                });
                cy.log('>>> [DEBUG] Channel cleanup completed');
            });
        } else {
            cy.log('>>> [DEBUG] Default team exists, no reset needed');
        }
        cy.log('>>> [DEBUG] sysadminSetup COMPLETED');
    });
}

function resetUserPreference(userId) {
    cy.apiSaveTeammateNameDisplayPreference('username');
    cy.apiSaveLinkPreviewsPreference('true');
    cy.apiSaveCollapsePreviewsPreference('false');
    cy.apiSaveClockDisplayModeTo24HourPreference(false);
    cy.apiSaveTutorialStep(userId, '999');
    cy.apiSaveOnboardingTaskListPreference(userId, 'onboarding_task_list_open', 'false');
    cy.apiSaveOnboardingTaskListPreference(userId, 'onboarding_task_list_show', 'false');
    cy.apiSaveCloudTrialBannerPreference(userId, 'trial', 'max_days_banner');
    cy.apiSaveSkipStepsPreference(userId, 'true');
    cy.apiSaveStartTrialModal(userId, 'true');
    cy.apiSaveUnreadScrollPositionPreference(userId, 'start_from_left_off');
}
