// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import AlertBanner from 'components/alert_banner';
import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';

import {getSkuDisplayName} from 'utils/subscription';
import {getRemainingDaysFromFutureTimestamp} from 'utils/utils';

import './renew_license_card.scss';

export interface RenewLicenseCardProps {
    license: ClientLicense;
    isLicenseExpired: boolean;
    totalUsers: number;
}

const RenewLicenseCard: React.FC<RenewLicenseCardProps> = ({license, totalUsers, isLicenseExpired}: RenewLicenseCardProps) => {
    let bannerType: 'info' | 'warning' | 'danger' = 'info';
    const endOfLicense = moment.utc(new Date(parseInt(license?.ExpiresAt, 10)));
    const daysToEndLicense = getRemainingDaysFromFutureTimestamp(parseInt(license?.ExpiresAt, 10));
    const contactSalesBtn = (
        <div className='purchase-card'>
            <ContactUsButton
                eventID='post_trial_contact_sales'
                customClass='light-blue-btn'
            />
        </div>
    );

    let cardTitle = (
        <FormattedMessage
            id='admin.license.renewalCard.licenseExpiring'
            defaultMessage='License expires in {days} days on {date, date, long}.'
            values={{
                date: endOfLicense,
                days: daysToEndLicense,
            }}
        />
    );
    if (isLicenseExpired) {
        bannerType = 'danger';
        cardTitle = (
            <FormattedMessage
                id='admin.license.renewalCard.licenseExpired'
                defaultMessage='License expired on {date, date, long}.'
                values={{
                    date: endOfLicense,
                }}
            />
        );
    }
    const message = (
        <div className='RenewLicenseCard__text'>
            <div className='RenewLicenseCard__text-description bolder'>
                <FormattedMessage
                    id='admin.license.renewalCard.description.contact_sales'
                    defaultMessage='Renew your {licenseSku} license by contacting sales to avoid any disruption.'
                    values={{
                        licenseSku: getSkuDisplayName(license.SkuShortName, license.IsGovSku === 'true'),
                    }}
                />
            </div>
            <div className='RenewLicenseCard__text-description'>
                <FormattedMessage
                    id='admin.license.renewalCard.reviewNumbers'
                    defaultMessage='Review your numbers below to ensure you renew for the right number of users.'
                />
            </div>
            <div className='RenewLicenseCard__licensedUsersNum'>
                <strong>
                    <FormattedMessage
                        id='admin.license.renewalCard.usersNumbers_licensed'
                        defaultMessage='Licensed Users: '
                    />
                </strong>
                {license.Users}
            </div>
            <div className='RenewLicenseCard__activeUsersNum'>
                <strong>
                    <FormattedMessage
                        id='admin.license.renewalCard.usersNumbers_active'
                        defaultMessage='Active Users: '
                    />
                </strong>
                {totalUsers}
            </div>
            <div className='RenewLicenseCard__buttons'>
                {contactSalesBtn}
            </div>
        </div>
    );
    return (
        <AlertBanner
            mode={bannerType}
            title={cardTitle}
            message={message}
        />
    );
};

export default RenewLicenseCard;
