// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import merge from 'deepmerge';

import {Constants} from '../../utils';

import onPremDefaultConfig from './on_prem_default_config.json';
import cloudDefaultConfig from './cloud_default_config.json';

// *****************************************************************************
// System
// https://api.mattermost.com/#tag/system
// *****************************************************************************

function hasLicenseForFeature(license, key) {
    let hasLicense = false;

    for (const [k, v] of Object.entries(license)) {
        if (k === key && v === 'true') {
            hasLicense = true;
            break;
        }
    }

    return hasLicense;
}

Cypress.Commands.add('apiGetClientLicense', () => {
    return cy.request('/api/v4/license/client?format=old').then((response) => {
        expect(response.status).to.equal(200);

        const license = response.body;
        const isLicensed = license.IsLicensed === 'true';
        const isCloudLicensed = hasLicenseForFeature(license, 'Cloud');

        return cy.wrap({
            license: response.body,
            isLicensed,
            isCloudLicensed,
        });
    });
});

Cypress.Commands.add('apiRequireLicenseForFeature', (...keys) => {
    Cypress.log({name: 'EE License', message: `Checking if server has license for feature: __${Object.values(keys).join(', ')}__.`});

    return uploadLicenseIfNotExist().then((data) => {
        const {license, isLicensed} = data;
        const hasLicenseMessage = `Server ${isLicensed ? 'has' : 'has no'} EE license.`;
        expect(isLicensed, hasLicenseMessage).to.equal(true);

        Object.values(keys).forEach((key) => {
            const hasLicenseKey = hasLicenseForFeature(license, key);
            const hasLicenseKeyMessage = `Server ${hasLicenseKey ? 'has' : 'has no'} EE license for feature: __${key}__`;
            expect(hasLicenseKey, hasLicenseKeyMessage).to.equal(true);
        });

        return cy.wrap(data);
    });
});

Cypress.Commands.add('apiRequireLicense', () => {
    Cypress.log({name: 'EE License', message: 'Checking if server has license.'});

    return uploadLicenseIfNotExist().then((data) => {
        const hasLicenseMessage = `Server ${data.isLicensed ? 'has' : 'has no'} EE license.`;
        expect(data.isLicensed, hasLicenseMessage).to.equal(true);

        return cy.wrap(data);
    });
});

Cypress.Commands.add('apiUploadLicense', (filePath) => {
    cy.apiUploadFile('license', filePath, {url: '/api/v4/license', method: 'POST', successStatus: 200});
});

Cypress.Commands.add('apiInstallTrialLicense', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/trial-license',
        method: 'POST',
        body: {
            trialreceive_emails_accepted: true,
            terms_accepted: true,
            users: Cypress.env('numberOfTrialUsers'),
        },
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response.body);
    });
});

Cypress.Commands.add('apiDeleteLicense', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/license',
        method: 'DELETE',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({response});
    });
});

export const getDefaultConfig = () => {
    const cypressEnv = Cypress.env();

    const fromCypressEnv = {
        ElasticsearchSettings: {
            ConnectionURL: cypressEnv.elasticsearchConnectionURL,
        },
        LdapSettings: {
            LdapServer: cypressEnv.ldapServer,
            LdapPort: cypressEnv.ldapPort,
        },
        ServiceSettings: {
            AllowedUntrustedInternalConnections: cypressEnv.allowedUntrustedInternalConnections,
            SiteURL: Cypress.config('baseUrl'),
        },
    };

    const isCloud = cypressEnv.serverEdition === Constants.ServerEdition.CLOUD;

    if (isCloud) {
        fromCypressEnv.CloudSettings = {
            CWSURL: cypressEnv.cwsURL,
            CWSAPIURL: cypressEnv.cwsAPIURL,
        };
    }

    const defaultConfig = isCloud ? cloudDefaultConfig : onPremDefaultConfig;

    return merge(defaultConfig, fromCypressEnv);
};

const expectConfigToBeUpdatable = (currentConfig, newConfig) => {
    function errorMessage(name) {
        return `${name} is restricted or not available to update. You may check user/sysadmin access, license requirement, server version or edition (on-prem/cloud) compatibility.`;
    }

    Object.entries(newConfig).forEach(([newMainKey, newSubSetting]) => {
        const setting = currentConfig[newMainKey];

        if (setting) {
            Object.keys(newSubSetting).forEach((newSubKey) => {
                const isAvailable = setting.hasOwnProperty(newSubKey);
                const name = `${newMainKey}.${newSubKey}`;
                expect(isAvailable, isAvailable ? `${name} setting can be updated.` : errorMessage(name)).to.equal(true);
            });
        } else {
            const withSetting = Boolean(setting);
            expect(withSetting, withSetting ? `${newMainKey} setting can be updated.` : errorMessage(newMainKey)).to.equal(true);
        }
    });
};

Cypress.Commands.add('apiUpdateConfig', (newConfig = {}) => {
    // # Get current config
    return cy.apiGetConfig().then(({config: currentConfig}) => {
        // * Check if config can be updated
        expectConfigToBeUpdatable(currentConfig, newConfig);

        const config = merge.all([currentConfig, getDefaultConfig(), newConfig]);

        // # Set the modified config
        return cy.request({
            url: '/api/v4/config',
            headers: {'X-Requested-With': 'XMLHttpRequest'},
            method: 'PUT',
            body: config,
        }).then((updateResponse) => {
            expect(updateResponse.status).to.equal(200);
            return cy.apiGetConfig();
        });
    });
});

Cypress.Commands.add('apiReloadConfig', () => {
    // # Reload the config
    return cy.request({
        url: '/api/v4/config/reload',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
    }).then((reloadResponse) => {
        expect(reloadResponse.status).to.equal(200);
        return cy.apiGetConfig();
    });
});

Cypress.Commands.add('apiGetConfig', (old = false) => {
    // # Get current settings
    return cy.request(`/api/v4/config${old ? '/client?format=old' : ''}`).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({config: response.body});
    });
});

Cypress.Commands.add('apiEnsureFeatureFlag', (key, value) => {
    cy.apiGetConfig().then(({config}) => {
        cy.log(JSON.stringify(config.PluginSettings.Plugins.playbooks));
        const currentValue = config.PluginSettings.Plugins.playbooks[key];
        if (currentValue !== value) {
            cy.apiUpdateConfig({
                PluginSettings: {Plugins: {playbooks: {[key]: value}}},
            }).then(() => {
                return cy.wrap({prevValue: currentValue, value});
            });
        }
        return cy.wrap({prevValue: currentValue, value});
    });
});

Cypress.Commands.add('apiGetAnalytics', () => {
    cy.apiAdminLogin();

    return cy.request('/api/v4/analytics/old').then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({analytics: response.body});
    });
});

Cypress.Commands.add('apiInvalidateCache', () => {
    return cy.request({
        url: '/api/v4/caches/invalidate',
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        method: 'POST',
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

function isCloudEdition() {
    return cy.apiGetClientLicense().then(({isCloudLicensed}) => {
        return cy.wrap(isCloudLicensed);
    });
}

Cypress.Commands.add('shouldNotRunOnCloudEdition', () => {
    isCloudEdition().then((isCloud) => {
        expect(isCloud, isCloud ? 'Should not run on Cloud server' : '').to.equal(false);
    });
});

function isTeamEdition() {
    return cy.apiGetClientLicense().then(({isLicensed}) => {
        return cy.wrap(!isLicensed);
    });
}

Cypress.Commands.add('shouldRunOnTeamEdition', () => {
    isTeamEdition().then((isTeam) => {
        expect(isTeam, isTeam ? '' : 'Should run on Team edition only').to.equal(true);
    });
});

function isElasticsearchEnabled() {
    return cy.apiGetConfig().then(({config}) => {
        let isEnabled = false;

        if (config.ElasticsearchSettings) {
            const {EnableAutocomplete, EnableIndexing, EnableSearching} = config.ElasticsearchSettings;

            isEnabled = EnableAutocomplete && EnableIndexing && EnableSearching;
        }

        return cy.wrap(isEnabled);
    });
}

Cypress.Commands.add('shouldHaveElasticsearchDisabled', () => {
    isElasticsearchEnabled().then((data) => {
        expect(data, data ? 'Should have Elasticsearch disabled' : '').to.equal(false);
    });
});

Cypress.Commands.add('shouldHavePluginUploadEnabled', () => {
    return cy.apiGetConfig().then(({config}) => {
        const isUploadEnabled = config.PluginSettings.EnableUploads;
        expect(isUploadEnabled, isUploadEnabled ? '' : 'Should have Plugin upload enabled').to.equal(true);
    });
});

Cypress.Commands.add('shouldHaveClusterEnabled', () => {
    return cy.apiGetConfig().then(({config}) => {
        const {Enable, ClusterName} = config.ClusterSettings;
        expect(Enable, Enable ? '' : 'Should have cluster enabled').to.equal(true);

        const sameClusterName = ClusterName === Cypress.env('serverClusterName');
        expect(sameClusterName, sameClusterName ? '' : `Should have cluster name set and as expected. Got "${ClusterName}" but expected "${Cypress.env('serverClusterName')}"`).to.equal(true);
    });
});

Cypress.Commands.add('shouldRunWithSubpath', () => {
    return cy.apiGetConfig().then(({config}) => {
        const isSubpath = Boolean(config.ServiceSettings.SiteURL.replace(/^https?:\/\//, '').split('/')[1]);
        expect(isSubpath, isSubpath ? '' : 'Should run on server running with subpath only').to.equal(true);
    });
});

Cypress.Commands.add('shouldHaveFeatureFlag', (key, expectedValue) => {
    return cy.apiGetConfig().then(({config}) => {
        const actualValue = config.FeatureFlags[key];
        const message = actualValue === expectedValue ?
            `Matches feature flag - "${key}: ${expectedValue}"` :
            `Expected feature flag "${key}" to be "${expectedValue}", but was "${actualValue}"`;
        expect(actualValue, message).to.equal(expectedValue);
    });
});

Cypress.Commands.add('shouldHaveEmailEnabled', () => {
    return cy.apiGetConfig().then(({config}) => {
        if (!config.ExperimentalSettings.RestrictSystemAdmin) {
            cy.apiEmailTest();
        }
    });
});

/**
 * Upload a license if it does not exist.
 */
function uploadLicenseIfNotExist() {
    return cy.apiGetClientLicense().then((data) => {
        if (data.isLicensed) {
            return cy.wrap(data);
        }

        return cy.apiInstallTrialLicense().then(() => {
            return cy.apiGetClientLicense();
        });
    });
}
