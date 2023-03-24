import {GlobalState} from '@mattermost/types/store';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

const e10 = 'E10';
const e20 = 'E20';
const professional = 'professional';
const enterprise = 'enterprise';

// isValidSkuShortName returns whether the SKU short name is one of the known strings;
// namely: E10 or professional, or E20 or enterprise
const isValidSkuShortName = (license: Record<string, string>) => {
    switch (license?.SkuShortName) {
    case e10:
    case e20:
    case professional:
    case enterprise:
        return true;
    default:
        return false;
    }
};

// isE20LicensedOrDevelopment returns true when the server is licensed with a legacy Mattermost
// Enterprise E20 License or a Mattermost Enterprise License, or has `EnableDeveloper` and
// `EnableTesting` configuration settings enabled, signaling a non-production, developer mode.
export const isE20LicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return checkE20Licensed(license) || isConfiguredForDevelopment(state);
};

export const checkE20Licensed = (license: Record<string, string>) => {
    if (license?.SkuShortName === e20 || license?.SkuShortName === enterprise) {
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

// isE10LicensedOrDevelopment returns true when the server is at least licensed with a legacy Mattermost
// Enterprise E10 License or a Mattermost Professional License, or has `EnableDeveloper` and
// `EnableTesting` configuration settings enabled, signaling a non-production, developer mode.
export const isE10LicensedOrDevelopment = (state: GlobalState): boolean => {
    const license = getLicense(state);

    return checkE10Licensed(license) || isConfiguredForDevelopment(state);
};

export const checkE10Licensed = (license: Record<string, string>) => {
    if (license?.SkuShortName === e10 || license?.SkuShortName === professional ||
        license?.SkuShortName === e20 || license?.SkuShortName === enterprise) {
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
