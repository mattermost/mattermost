// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useState} from 'react';
import type {RefObject} from 'react';
import {FormattedDate, FormattedMessage, FormattedNumber, FormattedTime, defineMessages, useIntl} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import Tag from 'components/widgets/tag/tag';

import {FileTypes} from 'utils/constants';
import {calculateOverageUserActivated} from 'utils/overage_team';
import {getSkuDisplayName} from 'utils/subscription';
import {getRemainingDaysFromFutureTimestamp, toTitleCase} from 'utils/utils';

import './enterprise_edition.scss';

const DAYS_UNTIL_EXPIRY_WARNING_DISPLAY_THRESHOLD = 30;
const DAYS_UNTIL_EXPIRY_DANGER_DISPLAY_THRESHOLD = 5;

export interface EnterpriseEditionProps {
    openEELicenseModal: () => void;
    upgradedFromTE: boolean;
    license: ClientLicense;
    isTrialLicense: boolean;
    handleRemove: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>;
    isDisabled: boolean;
    removing: boolean;
    fileInputRef: RefObject<HTMLInputElement>;
    handleChange: () => void;
    statsActiveUsers: number;
}

export const messages = defineMessages({
    keyRemove: {id: 'admin.license.keyRemove', defaultMessage: 'Remove license and downgrade to Mattermost Free'},
});

const EnterpriseEditionLeftPanel = ({
    openEELicenseModal,
    upgradedFromTE,
    license,
    isTrialLicense,
    handleRemove,
    isDisabled,
    removing,
    fileInputRef,
    handleChange,
    statsActiveUsers,
}: EnterpriseEditionProps) => {
    const {formatMessage} = useIntl();
    const [unsanitizedLicense, setUnsanitizedLicense] = useState(license);
    const openPricingModal = useOpenPricingModal();
    const [openContactSales] = useOpenSalesLink();

    useEffect(() => {
        async function fetchUnSanitizedLicense() {
            try {
                const unsanitizedL = await Client4.getClientLicenseOld();
                setUnsanitizedLicense(unsanitizedL);
            } catch {
                // do nothing
            }
        }
        fetchUnSanitizedLicense();
    }, [license]);

    const skuName = getSkuDisplayName(unsanitizedLicense.SkuShortName, unsanitizedLicense.IsGovSku === 'true');
    const expirationDays = getRemainingDaysFromFutureTimestamp(parseInt(unsanitizedLicense.ExpiresAt, 10));

    const viewPlansButton = (
        <button
            id='enterprise_edition_view_plans'
            onClick={() => openPricingModal({trackingLocation: 'license_settings_view_plans'})}
            className='btn btn-secondary PlanDetails__viewPlansButton'
        >
            {formatMessage({
                id: 'workspace_limits.menu_limit.view_plans',
                defaultMessage: 'View plans',
            })}
        </button>
    );

    return (
        <div
            className='EnterpriseEditionLeftPanel'
            data-testid='EnterpriseEditionLeftPanel'
        >
            <div className='EnterpriseEditionLeftPanel__Grid'>
                <div>
                    <div className='pre-title'>
                        <FormattedMessage
                            id='admin.license.enterpriseEdition'
                            defaultMessage='Enterprise Edition'
                        />
                    </div>
                    <div className='title'>
                        {`Mattermost ${skuName}`}
                        {isTrialLicense && (
                            <Tag
                                text={formatMessage({
                                    id: 'admin.license.Trial',
                                    defaultMessage: 'Trial',
                                })}
                                variant={'success'}
                                uppercase={true}
                                size={'sm'}
                            />
                        )}
                    </div>
                </div>
                {viewPlansButton}
            </div>
            <div className='subtitle'>
                <FormattedMessage
                    id='admin.license.enterpriseEdition.subtitle'
                    defaultMessage='This is an Enterprise Edition for the Mattermost {skuName} plan'
                    values={{skuName}}
                />
            </div>
            <div className='licenseInformation'>
                <div className='license-details-top'>
                    <span className='title'>{'License details'}</span>
                    <button
                        className='add-seats-button btn btn-primary'
                        onClick={openContactSales}
                    >
                        <FormattedMessage
                            id={'admin.license.enterpriseEdition.add.seats'}
                            defaultMessage='+ Add seats'
                        />
                    </button>
                </div>
                {
                    renderLicenseContent(
                        unsanitizedLicense,
                        isTrialLicense,
                        handleRemove,
                        isDisabled,
                        removing,
                        skuName,
                        fileInputRef,
                        handleChange,
                        statsActiveUsers,
                        expirationDays,
                    )
                }
            </div>
            <div className='license-notices'>
                {/* This notice should not be translated */}
                {upgradedFromTE ? <>
                    <p>
                        {'When using Mattermost Enterprise Edition, the software is offered under a commercial license. See '}
                        <a
                            role='button'
                            onClick={openEELicenseModal}
                            className='openEELicenseModal'
                        >
                            {'here'}
                        </a>
                        {' for “Enterprise Edition License” for details. '}
                        {'See NOTICE.txt for information about open source software used in the system.'}
                    </p>
                </> : <p>
                    {'This software is offered under a commercial license.\n\nSee ENTERPRISE-EDITION-LICENSE.txt in your root install directory for details. See NOTICE.txt for information about open source software used in this system.'}
                </p>
                }
            </div>
        </div>
    );
};

type LegendValues = 'START DATE:' | 'EXPIRES:' | 'LICENSED SEATS:' | 'ACTIVE USERS:' | 'EDITION:' | 'LICENSE ISSUED:' | 'NAME:' | 'COMPANY / ORG:'

const renderLicenseValues = (activeUsers: number, seatsPurchased: number, expirationDays: number) => ({legend, value}: {legend: LegendValues; value: string | JSX.Element | null}, index: number): React.ReactNode => {
    if (legend === 'ACTIVE USERS:') {
        const {isBetween5PercerntAnd10PercentPurchasedSeats, isOver10PercerntPurchasedSeats} = calculateOverageUserActivated({activeUsers, seatsPurchased});
        return (
            <div
                className='item-element'
                key={value + index.toString()}
            >
                <span
                    className={classNames({
                        legend: true,
                        'legend--warning-over-seats-purchased': isBetween5PercerntAnd10PercentPurchasedSeats,
                        'legend--over-seats-purchased': isOver10PercerntPurchasedSeats,
                    })}
                >{legend}</span>
                <span
                    className={classNames({
                        value: true,
                        'value--warning-over-seats-purchased': isBetween5PercerntAnd10PercentPurchasedSeats,
                        'value--over-seats-purchased': isOver10PercerntPurchasedSeats,
                    })}
                >{value}</span>
            </div>
        );
    } else if (legend === 'EXPIRES:') {
        return (
            <div
                className='item-element'
                key={value + index.toString()}
            >
                <span className='legend'>{legend}</span>
                <span className='value'>{value}</span>
                {(expirationDays <= DAYS_UNTIL_EXPIRY_WARNING_DISPLAY_THRESHOLD) &&
                <span
                    className={classNames('expiration-days', {
                        'expiration-days-warning': expirationDays <= DAYS_UNTIL_EXPIRY_WARNING_DISPLAY_THRESHOLD,
                        'expiration-days-danger': expirationDays <= DAYS_UNTIL_EXPIRY_DANGER_DISPLAY_THRESHOLD,
                    })}
                >
                    {`Expires in ${expirationDays} day${expirationDays > 1 ? 's' : ''}`}
                </span>
                }
            </div>
        );
    }

    return (
        <div
            className='item-element'
            key={value + index.toString()}
        >
            <span className='legend'>{legend}</span>
            <span className='value'>{value}</span>
        </div>
    );
};

const renderLicenseContent = (
    license: ClientLicense,
    isTrialLicense: boolean,
    handleRemove: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>,
    isDisabled: boolean,
    removing: boolean,
    skuName: string,
    fileInputRef: RefObject<HTMLInputElement>,
    handleChange: () => void,
    statsActiveUsers: number,
    expirationDays: number,
) => {
    // Note: DO NOT LOCALISE THESE STRINGS. Legally we can not since the license is in English.

    const sku = license.SkuShortName ? <>{`Mattermost ${toTitleCase(skuName)}${isTrialLicense ? ' License Trial' : ''}`}</> : null;

    const users = <FormattedNumber value={parseInt(license.Users, 10)}/>;
    const activeUsers = <FormattedNumber value={statsActiveUsers}/>;
    const startsAt = <FormattedDate value={new Date(parseInt(license.StartsAt, 10))}/>;
    const expiresAt = <FormattedDate value={new Date(parseInt(license.ExpiresAt, 10))}/>;

    const issued = (
        <>
            <FormattedDate value={new Date(parseInt(license.IssuedAt, 10))}/>
            {' '}
            <FormattedTime value={new Date(parseInt(license.IssuedAt, 10))}/>
        </>
    );

    const licenseValues: Array<{
        legend: LegendValues;
        value: string;
    } | {
        legend: LegendValues;
        value: JSX.Element | null;
    }> = [
        {legend: 'START DATE:', value: startsAt},
        {legend: 'EXPIRES:', value: expiresAt},
        {legend: 'LICENSED SEATS:', value: users},
        {legend: 'ACTIVE USERS:', value: activeUsers},
        {legend: 'EDITION:', value: sku},
        {legend: 'LICENSE ISSUED:', value: issued},
        {legend: 'NAME:', value: license.Name},
        {legend: 'COMPANY / ORG:', value: license.Company},
    ];

    return (
        <div className='licenseElements'>
            {licenseValues.map(renderLicenseValues(statsActiveUsers, parseInt(license.Users, 10), expirationDays))}
            <hr/>
            {renderAddNewLicenseButton(fileInputRef, handleChange)}
            {renderRemoveButton(handleRemove, isDisabled, removing)}
        </div>
    );
};

const renderAddNewLicenseButton = (
    fileInputRef: RefObject<HTMLInputElement>,
    handleChange: () => void,
) => {
    return (
        <>
            <button
                className='add-new-licence-btn'
                onClick={() => fileInputRef.current?.click()}
            >
                <FormattedMessage
                    id='admin.license.keyAddNew'
                    defaultMessage='Add a new license'
                />
            </button>
            <input
                ref={fileInputRef}
                type='file'
                accept={FileTypes.LICENSE_EXTENSION}
                onChange={handleChange}
                style={{display: 'none'}}
            />
        </>
    );
};

const renderRemoveButton = (
    handleRemove: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void>,
    isDisabled: boolean,
    removing: boolean,
) => {
    let removeButtonText = (<FormattedMessage {...messages.keyRemove}/>);
    if (removing) {
        removeButtonText = (
            <FormattedMessage
                id='admin.license.removing'
                defaultMessage='Removing License...'
            />
        );
    }

    return (
        <>
            <div className='remove-button'>
                <button
                    type='button'
                    className='btn btn-danger'
                    onClick={handleRemove}
                    disabled={isDisabled}
                    id='remove-button'
                    data-testid='remove-button'
                >
                    {removeButtonText}
                </button>
            </div>
        </>
    );
};

export default React.memo(EnterpriseEditionLeftPanel);
