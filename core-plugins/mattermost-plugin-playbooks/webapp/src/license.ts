// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

const professional = 'professional';
const enterprise = 'enterprise';
const enterpriseAdvanced = 'advanced';
const entry = 'entry';

// isValidSkuShortName returns whether the SKU short name is one of the known strings;
// namely: entry, professional, enterprise or enterprise advanced.
const isValidSkuShortName = (license: Record<string, string>) => {
    switch (license?.SkuShortName) {
    case entry:
    case professional:
    case enterprise:
    case enterpriseAdvanced:
        return true;
    default:
        return false;
    }
};

// isEnterpriseLicensedOrDevelopment returns true when the server is licensed with minimum Mattermost
// Enterprise License, or has `EnableDeveloper` and `EnableTesting`
// configuration settings enabled, signaling a non-production, developer mode.
export const isEnterpriseLicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return checkEnterpriseLicensed(license) || isConfiguredForDevelopment(state);
};

export const checkEnterpriseLicensed = (license: Record<string, string>) => {
    if ([enterprise, entry, enterpriseAdvanced].includes(license?.SkuShortName)) {
        return true;
    }

    if (!isValidSkuShortName(license)) {
        // As a fallback for licenses whose SKU short name is unknown, make a best effort to try
        // and use the presence of a known E20/Enterprise feature as a check to determine licensing.
        if (license?.MessageExport === 'true') {
            return true;
        }
    }

    return false;
};

// isProfressionalLicensedOrDevelopment returns true when the server is at least licensed with a Mattermost Professional License,
// or has `EnableDeveloper` and `EnableTesting` configuration settings enabled,
// signaling a non-production, developer mode.
export const isProfessionalLicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return checkProfessionalLicensed(license) || isConfiguredForDevelopment(state);
};

export const checkProfessionalLicensed = (license: Record<string, string>) => {
    if ([professional, enterprise, entry, enterpriseAdvanced].includes(license?.SkuShortName)) {
        return true;
    }

    if (!isValidSkuShortName(license)) {
        // As a fallback for licenses whose SKU short name is unknown, make a best effort to try
        // and use the presence of a known E10/Professional feature as a check to determine licensing.
        if (license?.LDAP === 'true') {
            return true;
        }
    }

    return false;
};

export const isConfiguredForDevelopment = (state: GlobalState): boolean => {
    const config = getConfig(state);

    return config.EnableTesting === 'true' && config.EnableDeveloper === 'true';
};

export const isCloud = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return license?.Cloud === 'true';
};
