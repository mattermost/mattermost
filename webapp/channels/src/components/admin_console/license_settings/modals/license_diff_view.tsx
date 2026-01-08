// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage} from 'react-intl';

import type {ClientLicense, License} from '@mattermost/types/config';

import {LicenseSkus} from 'utils/constants';
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
};

type InfoRowProps = {
    label: React.ReactNode;
    value: React.ReactNode;
};

const DiffRow = ({label, currentValue, newValue, changed}: DiffRowProps) => (
    <tr className={changed ? 'diff-row changed' : 'diff-row'}>
        <td className='diff-label'>{label}</td>
        <td className='diff-current'>{currentValue}</td>
        <td className='diff-new'>{newValue}</td>
    </tr>
);

const InfoRow = ({label, value}: InfoRowProps) => (
    <tr className='info-row'>
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

const LicenseDiffView = ({currentLicense, newLicense, locale}: Props) => {
    const hasCurrentLicense = currentLicense && Object.keys(currentLicense).length > 0 && currentLicense.IsLicensed === 'true';
    const isEntryLicense = hasCurrentLicense && currentLicense.SkuShortName?.toLowerCase() === LicenseSkus.Entry;

    // If current license is "entry", show only new license info (no comparison)
    if (isEntryLicense || !hasCurrentLicense) {
        return (
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
                                    id='admin.license.diff.expiresAt'
                                    defaultMessage='Expiration Date'
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
