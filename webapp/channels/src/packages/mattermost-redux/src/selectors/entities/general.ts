// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GiphyFetch} from '@giphy/js-fetch-api';

import type {ClientConfig, FeatureFlags, ClientLicense} from '@mattermost/types/config';
import type {GlobalState} from '@mattermost/types/store';

import {General} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {isMinimumServerVersion} from 'mattermost-redux/utils/helpers';

export function getConfig(state: GlobalState): Partial<ClientConfig> {
    return state.entities.general.config;
}

/**
 * Safely get value of a specific or known FeatureFlag
 */
export function getFeatureFlagValue(state: GlobalState, key: keyof FeatureFlags): string | undefined {
    return getConfig(state)?.[`FeatureFlag${key}` as keyof Partial<ClientConfig>];
}

export type PasswordConfig = {
    minimumLength: number;
    requireLowercase: boolean;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
};

export const getPasswordConfig: (state: GlobalState) => PasswordConfig = createSelector(
    'getPasswordConfig',
    getConfig,
    (config) => {
        return {
            minimumLength: parseInt(config.PasswordMinimumLength!, 10),
            requireLowercase: config.PasswordRequireLowercase === 'true',
            requireUppercase: config.PasswordRequireUppercase === 'true',
            requireNumber: config.PasswordRequireNumber === 'true',
            requireSymbol: config.PasswordRequireSymbol === 'true',
        };
    },
);

export function getLicense(state: GlobalState): ClientLicense {
    return state.entities.general.license;
}

export const isCloudLicense: (state: GlobalState) => boolean = createSelector(
    'isCloudLicense',
    getLicense,
    (license: ClientLicense) => license?.Cloud === 'true',
);

export function isCompatibleWithJoinViewTeamPermissions(state: GlobalState): boolean {
    const version = state.entities.general.serverVersion;
    return isMinimumServerVersion(version, 5, 10, 0) ||
       (version.indexOf('dev') !== -1 && isMinimumServerVersion(version, 5, 8, 0)) ||
       (version.match(/^5.8.\d.\d\d\d\d.*$/) !== null && isMinimumServerVersion(version, 5, 8, 0));
}

export const canUploadFilesOnMobile: (a: GlobalState) => boolean = createSelector(
    'canUploadFilesOnMobile',
    getConfig,
    getLicense,
    (config: Partial<ClientConfig>, license: any): boolean => {
        // Defaults to true if either setting doesn't exist
        return config.EnableFileAttachments !== 'false' &&
           (license.IsLicensed === 'false' || license.Compliance === 'false' || config.EnableMobileFileUpload !== 'false');
    },
);

export const canDownloadFilesOnMobile: (a: GlobalState) => boolean = createSelector(
    'canDownloadFilesOnMobile',
    getConfig,
    getLicense,
    (config: Partial<ClientConfig>, license: any): boolean => {
        // Defaults to true if the setting doesn't exist
        return license.IsLicensed === 'false' || license.Compliance === 'false' || config.EnableMobileFileDownload !== 'false';
    },
);

export const getAutolinkedUrlSchemes: (a: GlobalState) => string[] = createSelector(
    'getAutolinkedUrlSchemes',
    getConfig,
    (config: Partial<ClientConfig>): string[] => {
        if (!config.CustomUrlSchemes) {
            return General.DEFAULT_AUTOLINKED_URL_SCHEMES;
        }

        return [
            ...General.DEFAULT_AUTOLINKED_URL_SCHEMES,
            ...config.CustomUrlSchemes.split(','),
        ];
    },
);

export const getManagedResourcePaths: (state: GlobalState) => string[] = createSelector(
    'getManagedResourcePaths',
    getConfig,
    (config) => {
        if (!config.ManagedResourcePaths) {
            return [];
        }

        return config.ManagedResourcePaths.split(',').map((path) => path.trim());
    },
);

export const getServerVersion = (state: GlobalState): string => {
    return state.entities.general.serverVersion;
};

export function getFirstAdminVisitMarketplaceStatus(state: GlobalState): boolean {
    return state.entities.general.firstAdminVisitMarketplaceStatus;
}

export function getFirstAdminSetupComplete(state: GlobalState): boolean {
    return state.entities.general.firstAdminCompleteSetup;
}

export function isPerformanceDebuggingEnabled(state: GlobalState): boolean {
    return state.entities.general.config.EnableClientPerformanceDebugging === 'true';
}

export const isMarketplaceEnabled: (state: GlobalState) => boolean = createSelector(
    'isMarketplaceEnabled',
    getConfig,
    (config) => {
        return config.PluginsEnabled === 'true' && config.EnableMarketplace === 'true';
    },
);

export const getGiphyFetchInstance: (state: GlobalState) => GiphyFetch | null = createSelector(
    'getGiphyFetchInstance',
    (state) => getConfig(state).GiphySdkKey,
    (giphySdkKey) => {
        if (giphySdkKey) {
            const giphyFetch = new GiphyFetch(giphySdkKey);
            return giphyFetch;
        }

        return null;
    },
);

export const getUsersStatusAndProfileFetchingPollInterval: (state: GlobalState) => number | null = createSelector(
    'getUsersStatusAndProfileFetchingPollInterval',
    getConfig,
    (config) => {
        const usersStatusAndProfileFetchingPollInterval = config.UsersStatusAndProfileFetchingPollIntervalMilliseconds;
        if (usersStatusAndProfileFetchingPollInterval) {
            return parseInt(usersStatusAndProfileFetchingPollInterval, 10);
        }

        return null;
    },
);
