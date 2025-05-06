// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import AlertBanner from 'components/alert_banner';
import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';

import {daysToLicenseExpire} from 'utils/license_utils';
import {getSkuDisplayName} from 'utils/subscription';
import {getBrowserTimezone} from 'utils/timezone';

import './trial_license_card.scss';

export interface Props {
    license: ClientLicense;
}

const TrialLicenseCard: React.FC<Props> = ({license}: Props) => {
    const currentDate = new Date();
    const endDate = new Date(parseInt(license?.ExpiresAt, 10));
    const daysToEndLicense = daysToLicenseExpire(license);

    const messageBody = () => {
        if (currentDate.toDateString() === endDate.toDateString()) {
            return (
                <FormattedMessage
                    id='admin.license.trialLicenseCard.expiringToday'
                    defaultMessage='Your free trial expires <b>Today at {time}</b>. Contact sales to purchase a license and continue using advanced features after the trial ends.'
                    values={{
                        b: (chunks: string) => <b>{chunks}</b>,
                        time: moment(endDate).endOf('day').format('h:mm a ') + moment().tz(getBrowserTimezone()).format('z'),
                    }}
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.license.trialLicenseCard.expiringAfterFewDays'
                defaultMessage='Your free trial will expire in <b>{daysCount} {daysCount, plural, one {day} other {days}}</b>. Contact sales to purchase a license and continue using advanced features.'
                values={{
                    b: (chunks: string) => <b>{chunks}</b>,
                    daysCount: daysToEndLicense,
                }}
            />
        );
    };

    const message = (
        <div className='RenewLicenseCard TrialLicense'>
            <div className='RenewLicenseCard__text'>
                <div className='RenewLicenseCard__text-description'>
                    {messageBody()}
                </div>
                <div className='RenewLicenseCard__buttons'>
                    <ContactUsButton
                        customClass='contact_us_primary_cta'
                    />
                </div>
            </div>
        </div>
    );

    const cardTitle = (
        <FormattedMessage
            id='admin.license.trialCard.licenseExpiring'
            defaultMessage='You’re currently on a free trial of our Mattermost {licenseType}.'
            values={{
                licenseType: getSkuDisplayName(license.SkuShortName, license.IsGovSku === 'true'),
            }}
        />
    );
    return (
        <AlertBanner
            mode={'info'}
            title={cardTitle}
            message={message}
        />
    );
};

export default TrialLicenseCard;
