// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage} from 'react-intl';

import type {ClientLicense, License} from '@mattermost/types/config';

import ExternalLink from 'components/external_link';

import {CloudLinks, LicenseSkus} from 'utils/constants';
import {getMonthLong} from 'utils/i18n';

import './license_diff_view.scss';

type Props = {
    currentLicense: ClientLicense;
    newLicense: License;
    locale: string;
};

type DiffRowProps = {
    label: React.ReactNode;
    currentValue: React.ReactNode;
    newValue: React.ReactNode;
    changed: boolean;
    className?: string;
};

type InfoRowProps = {
    label: React.ReactNode;
    value: React.ReactNode;
    className?: string;
};

const DiffRow = ({label, currentValue, newValue, changed, className}: DiffRowProps) => (
    <tr className={`${changed ? 'diff-row changed' : 'diff-row'}${className ? ` ${className}` : ''}`}>
        <td className='diff-label'>{label}</td>
        <td className='diff-current'>{currentValue}</td>
        <td className='diff-new'>{newValue}</td>
    </tr>
);

const InfoRow = ({label, value, className}: InfoRowProps) => (
    <tr className={className ? `info-row ${className}` : 'info-row'}>
        <td className='info-label'>{label}</td>
        <td className='info-value'>{value}</td>
    </tr>
);

const formatDate = (timestamp: number | string, locale: string) => {
    const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
    if (!ts || isNaN(ts)) {
        return '-';
    }
    return (
        <FormattedDate
            value={new Date(ts)}
            day='2-digit'
            month={getMonthLong(locale)}
            year='numeric'
        />
    );
};

type BannerVariant = 'warning' | 'info' | 'success' | 'danger';

type BannerConfig = {
    variant: BannerVariant;
    icon: string;
    title: React.ReactNode;
    description: React.ReactNode;
    showPlanDiffLink: boolean;
};

const getPlanLevel = (skuShortName: string | undefined): number => {
    switch (skuShortName?.toLowerCase()) {
    case LicenseSkus.Entry:
        return 0;
    case LicenseSkus.Professional:
        return 1;
    case LicenseSkus.Enterprise:
        return 2;
    case LicenseSkus.EnterpriseAdvanced:
        return 3;
    default:
        return -1;
    }
};

// Entry transitions (info-only view)
const getEntryTransitionBanner = (newSkuShortName: string | undefined): BannerConfig | null => {
    const sku = newSkuShortName?.toLowerCase();

    switch (sku) {
    case LicenseSkus.Professional:
        return {
            variant: 'warning',
            icon: 'icon-alert-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_professional.title'
                    defaultMessage='This license changes your available features'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_professional.description'
                    defaultMessage='Mattermost Professional adds paid-tier capabilities such as unlimited message history. Some features in Mattermost Entry are not included in Professional (see plan differences).'
                />
            ),
            showPlanDiffLink: true,
        };
    case LicenseSkus.Enterprise:
        return {
            variant: 'info',
            icon: 'icon-information-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_enterprise.title'
                    defaultMessage='This license adds Enterprise capabilities, with feature changes'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_enterprise.description'
                    defaultMessage='Mattermost Enterprise includes unlimited message history and adds enterprise-grade scale, compliance, and administration capabilities. Some features in Mattermost Entry are not included in Enterprise.'
                />
            ),
            showPlanDiffLink: true,
        };
    case LicenseSkus.EnterpriseAdvanced:
        return {
            variant: 'success',
            icon: 'icon-arrow-up-bold-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_advanced.title'
                    defaultMessage='This license adds Enterprise Advanced capabilities'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.entry_to_advanced.description'
                    defaultMessage='Mattermost Enterprise Advanced includes all Enterprise features, unlocks unlimited message history, and adds exclusive capabilities like Zero Trust security, sensitive information controls, mobile security hardening for mission-critical operations'
                />
            ),
            showPlanDiffLink: false,
        };
    default:
        return null;
    }
};

// Upgrade banners (comparison diff view)
const getUpgradeBanner = (currentSkuShortName: string | undefined, newSkuShortName: string | undefined): BannerConfig | null => {
    const newSku = newSkuShortName?.toLowerCase();

    if (newSku === LicenseSkus.Enterprise) {
        return {
            variant: 'success',
            icon: 'icon-information-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.upgrade_to_enterprise.title'
                    defaultMessage='This license adds Enterprise capabilities'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.upgrade_to_enterprise.description'
                    defaultMessage='Mattermost Enterprise includes all features available in Mattermost Professional, plus enterprise scale and high availability, advanced compliance and administration features, and enterprise support options.'
                />
            ),
            showPlanDiffLink: false,
        };
    }

    if (newSku === LicenseSkus.EnterpriseAdvanced) {
        return {
            variant: 'success',
            icon: 'icon-arrow-up-bold-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.upgrade_to_advanced.title'
                    defaultMessage='This license adds Enterprise Advanced capabilities'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.upgrade_to_advanced.description'
                    defaultMessage='Mattermost Enterprise Advanced includes all Enterprise features, plus Zero Trust security, sensitive information controls, mobile security hardening for mission-critical operations.'
                />
            ),
            showPlanDiffLink: false,
        };
    }

    return null;
};

// Downgrade banners (comparison diff view)
const getDowngradeBanner = (currentSkuShortName: string | undefined, newSkuShortName: string | undefined): BannerConfig | null => {
    const currentSku = currentSkuShortName?.toLowerCase();
    const newSku = newSkuShortName?.toLowerCase();

    if (currentSku === LicenseSkus.Enterprise && newSku === LicenseSkus.Professional) {
        return {
            variant: 'danger',
            icon: 'icon-alert-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade.title'
                    defaultMessage='This license downgrades your plan'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade_enterprise_to_professional.description'
                    defaultMessage='You will lose access to Enterprise features including enterprise scale and high availability, advanced compliance and administration features, and enterprise support options.'
                />
            ),
            showPlanDiffLink: true,
        };
    }

    if (currentSku === LicenseSkus.EnterpriseAdvanced && newSku === LicenseSkus.Enterprise) {
        return {
            variant: 'danger',
            icon: 'icon-alert-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade.title'
                    defaultMessage='This license downgrades your plan'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade_advanced_to_enterprise.description'
                    defaultMessage='You will lose access to Mattermost Enterprise Advanced features, including Zero Trust security, sensitive information controls, and mobile security hardening.'
                />
            ),
            showPlanDiffLink: true,
        };
    }

    if (currentSku === LicenseSkus.EnterpriseAdvanced && newSku === LicenseSkus.Professional) {
        return {
            variant: 'danger',
            icon: 'icon-alert-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade.title'
                    defaultMessage='This license downgrades your plan'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.downgrade_advanced_to_professional.description'
                    defaultMessage='You will lose access to Enterprise features for high availability administration, as well as Enterprise Advanced features including Zero Trust security, sensitive information controls, and advanced mobile security controls for mission-critical operations.'
                />
            ),
            showPlanDiffLink: true,
        };
    }

    return null;
};

// Get the appropriate banner for any license transition
const getTransitionBanner = (currentSkuShortName: string | undefined, newSkuShortName: string | undefined): BannerConfig | null => {
    const currentLevel = getPlanLevel(currentSkuShortName);
    const newLevel = getPlanLevel(newSkuShortName);

    if (currentLevel < 0 || newLevel < 0 || currentLevel === newLevel) {
        return null;
    }

    if (newLevel > currentLevel) {
        return getUpgradeBanner(currentSkuShortName, newSkuShortName);
    }

    return getDowngradeBanner(currentSkuShortName, newSkuShortName);
};

const LicenseTransitionBanner = ({config}: {config: BannerConfig}) => (
    <div className={`license-transition-banner license-transition-banner--${config.variant}`}>
        <div className='license-transition-banner__icon'>
            <i className={`icon ${config.icon}`}/>
        </div>
        <div className='license-transition-banner__content'>
            <div className='license-transition-banner__title'>
                {config.title}
            </div>
            <div className='license-transition-banner__description'>
                {config.description}
            </div>
            {config.showPlanDiffLink && (
                <ExternalLink
                    className='license-transition-banner__link'
                    href={CloudLinks.SELF_HOSTED_PRICING}
                    location='license_diff_view'
                >
                    <FormattedMessage
                        id='admin.license.diff.banner.viewPlanDifferences'
                        defaultMessage='View plan differences'
                    />
                </ExternalLink>
            )}
        </div>
    </div>
);

const LicenseDiffView = ({currentLicense, newLicense, locale}: Props) => {
    const hasCurrentLicense = currentLicense && Object.keys(currentLicense).length > 0 && currentLicense.IsLicensed === 'true';
    const isEntryLicense = hasCurrentLicense && currentLicense.SkuShortName?.toLowerCase() === LicenseSkus.Entry;

    // If current license is "entry", show only new license info (no comparison)
    if (isEntryLicense || !hasCurrentLicense) {
        const bannerConfig = isEntryLicense ? getEntryTransitionBanner(newLicense.sku_short_name) : null;

        return (
            <>
                {bannerConfig && <LicenseTransitionBanner config={bannerConfig}/>}
                <div className='license-diff-view'>
                    <table className='diff-table info-only'>
                        <tbody>
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.sku'
                                        defaultMessage='Plan'
                                    />
                                }
                                value={newLicense.sku_name || '-'}
                                className='info-row-plan'
                            />
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.startsAt'
                                        defaultMessage='Start Date'
                                    />
                                }
                                value={formatDate(newLicense.starts_at, locale)}
                            />
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.endDate'
                                        defaultMessage='End Date'
                                    />
                                }
                                value={formatDate(newLicense.expires_at, locale)}
                            />
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.users'
                                        defaultMessage='Users'
                                    />
                                }
                                value={newLicense.features?.users ?? '-'}
                            />
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.name'
                                        defaultMessage='Name'
                                    />
                                }
                                value={newLicense.customer?.name || '-'}
                            />
                            <InfoRow
                                label={
                                    <FormattedMessage
                                        id='admin.license.diff.company'
                                        defaultMessage='Company'
                                    />
                                }
                                value={newLicense.customer?.company || '-'}
                            />
                        </tbody>
                    </table>
                </div>
            </>
        );
    }

    // Helper to check if a value changed
    const isChanged = (currentVal: string | undefined, newVal: string | number | boolean | undefined): boolean => {
        const currentStr = currentVal ?? '';
        const newStr = String(newVal ?? '');
        return currentStr !== newStr;
    };

    const bannerConfig = getTransitionBanner(currentLicense.SkuShortName, newLicense.sku_short_name);

    return (
        <>
            {bannerConfig && <LicenseTransitionBanner config={bannerConfig}/>}
            <div className='license-diff-view'>
                <table className='diff-table'>
                    <thead>
                        <tr>
                            <th> </th>
                            <th>
                                <FormattedMessage
                                    id='admin.license.diff.currentLicense'
                                    defaultMessage='Current License'
                                />
                            </th>
                            <th>
                                <FormattedMessage
                                    id='admin.license.diff.newLicense'
                                    defaultMessage='New License'
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.sku'
                                    defaultMessage='Plan'
                                />
                            }
                            currentValue={currentLicense.SkuName || '-'}
                            newValue={newLicense.sku_name || '-'}
                            changed={isChanged(currentLicense.SkuShortName, newLicense.sku_short_name)}
                            className='diff-row-plan'
                        />
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.startsAt'
                                    defaultMessage='Start Date'
                                />
                            }
                            currentValue={formatDate(currentLicense.StartsAt, locale)}
                            newValue={formatDate(newLicense.starts_at, locale)}
                            changed={isChanged(currentLicense.StartsAt, newLicense.starts_at)}
                        />
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.endDate'
                                    defaultMessage='End Date'
                                />
                            }
                            currentValue={formatDate(currentLicense.ExpiresAt, locale)}
                            newValue={formatDate(newLicense.expires_at, locale)}
                            changed={isChanged(currentLicense.ExpiresAt, newLicense.expires_at)}
                        />
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.users'
                                    defaultMessage='Users'
                                />
                            }
                            currentValue={currentLicense.Users || '-'}
                            newValue={newLicense.features?.users ?? '-'}
                            changed={isChanged(currentLicense.Users, newLicense.features?.users)}
                        />
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.name'
                                    defaultMessage='Name'
                                />
                            }
                            currentValue={currentLicense.Name || '-'}
                            newValue={newLicense.customer?.name || '-'}
                            changed={isChanged(currentLicense.Name, newLicense.customer?.name)}
                        />
                        <DiffRow
                            label={
                                <FormattedMessage
                                    id='admin.license.diff.company'
                                    defaultMessage='Company'
                                />
                            }
                            currentValue={currentLicense.Company || '-'}
                            newValue={newLicense.customer?.company || '-'}
                            changed={isChanged(currentLicense.Company, newLicense.customer?.company)}
                        />
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default LicenseDiffView;
