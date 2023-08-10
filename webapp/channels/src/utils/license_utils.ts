// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';

import {LicenseSkus} from 'utils/constants';

import type {ClientLicense} from '@mattermost/types/config';

const LICENSE_EXPIRY_NOTIFICATION = 1000 * 60 * 60 * 24 * 60; // 60 days
const LICENSE_GRACE_PERIOD = 1000 * 60 * 60 * 24 * 10; // 10 days

export function isLicenseExpiring(license: ClientLicense) {
    // Skip license expiration checks for cloud licenses
    if (license.IsLicensed !== 'true' || isCloudLicense(license)) {
        return false;
    }

    if (license.IsTrial === 'true') {
        return true;
    }

    const timeDiff = parseInt(license.ExpiresAt, 10) - Date.now();
    return timeDiff <= LICENSE_EXPIRY_NOTIFICATION;
}

export function daysToLicenseExpire(license: ClientLicense) {
    if (license.IsLicensed !== 'true' || isCloudLicense(license)) {
        return undefined;
    }

    const endDate = new Date(parseInt(license?.ExpiresAt, 10));
    return moment(endDate).startOf('day').diff(moment().startOf('day'), 'days');
}

export function isLicenseExpired(license: ClientLicense) {
    if (license.IsLicensed !== 'true' || isCloudLicense(license)) {
        return false;
    }

    const endDate = new Date(parseInt(license?.ExpiresAt, 10));
    const timeDiff = moment(endDate).startOf('day').diff(moment().startOf('day'), 'days');
    return timeDiff < 0;
}

export function isLicensePastGracePeriod(license: ClientLicense) {
    if (license.IsLicensed !== 'true' || isCloudLicense(license)) {
        return false;
    }

    const timeDiff = Date.now() - parseInt(license.ExpiresAt, 10);
    return timeDiff > LICENSE_GRACE_PERIOD;
}

export function isTrialLicense(license: ClientLicense) {
    if (license.IsLicensed !== 'true') {
        return false;
    }

    if (license.IsTrial === 'true') {
        return true;
    }

    // Currently all trial licenses are issued with a 30 day, 8 hours duration.
    // We're using this logic to detect a trial license until we add the right field in the license itself.
    const timeDiff = parseInt(license.ExpiresAt, 10) - parseInt(license.StartsAt, 10);

    // 30 days + 8 hours
    const trialLicenseDuration = (1000 * 60 * 60 * 24 * 30) + (1000 * 60 * 60 * 8);

    return timeDiff === trialLicenseDuration;
}

export function isCloudLicense(license: ClientLicense) {
    return license?.Cloud === 'true';
}

export function getIsStarterLicense(license: ClientLicense) {
    return license?.SkuShortName === LicenseSkus.Starter;
}

export function getIsGovSku(license: ClientLicense) {
    return license?.IsGovSku === 'true';
}

export function isEnterpriseOrE20License(license: ClientLicense) {
    return license?.SkuShortName === LicenseSkus.Enterprise || license?.SkuShortName === LicenseSkus.E20;
}

export const isEnterpriseLicense = (license?: ClientLicense) => {
    switch (license?.SkuShortName) {
    case LicenseSkus.Enterprise:
    case LicenseSkus.E20:
        return true;
    }

    return false;
};

export const isNonEnterpriseLicense = (license?: ClientLicense) => !isEnterpriseLicense(license);

export const licenseSKUWithFirstLetterCapitalized = (license: ClientLicense) => {
    const sku = license.SkuShortName;
    return sku.charAt(0).toUpperCase() + sku.slice(1);
};
