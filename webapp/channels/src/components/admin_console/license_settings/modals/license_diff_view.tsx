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

type BannerVariant = 'warning' | 'info' | 'success';

type BannerConfig = {
    variant: BannerVariant;
    icon: string;
    title: React.ReactNode;
    description: React.ReactNode;
    showPlanDiffLink: boolean;
};

const getEntryTransitionBanner = (newSkuShortName: string | undefined): BannerConfig | null => {
    const sku = newSkuShortName?.toLowerCase();

    switch (sku) {
    case LicenseSkus.Professional:
        return {
            variant: 'warning',
            icon: 'icon-alert-circle-outline',
            title: (
                <FormattedMessage
                    id='admin.license.diff.banner.professional.title'
                    defaultMessage='This license changes your available features'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.professional.description'
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
                    id='admin.license.diff.banner.enterprise.title'
                    defaultMessage='This license adds Enterprise capabilities, with feature changes'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.enterprise.description'
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
                    id='admin.license.diff.banner.enterprise_advanced.title'
                    defaultMessage='This license adds Enterprise Advanced capabilities'
                />
            ),
            description: (
                <FormattedMessage
                    id='admin.license.diff.banner.enterprise_advanced.description'
                    defaultMessage='Mattermost Enterprise Advanced includes all Enterprise features, unlocks unlimited message history, and adds exclusive capabilities like Zero Trust security, sensitive information controls, mobile security hardening for mission-critical operations'
                />
            ),
            showPlanDiffLink: false,
        };
    default:
        return null;
    }
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

    return (
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
                                id='admin.license.diff.expiresAt'
                                defaultMessage='Expiration Date'
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
    );
};

export default LicenseDiffView;
