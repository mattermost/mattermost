// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import ExternalLink from 'components/external_link';

import AlertBanner from '../../alert_banner';

export interface UserSeatAlertBannerProps {
    license: ClientLicense;
    totalUsers: number;
}

const CONTACT_SALES_URL = 'https://mattermost.com/contact-sales/';

const UserSeatAlertBanner: React.FC<UserSeatAlertBannerProps> = ({license, totalUsers}) => {
    const [visible, setVisible] = useState(true);
    const {formatMessage} = useIntl();
    if (!visible) {
        return null;
    }
    if (!license || !license.Users) {
        return null;
    }
    const licensedUsers = parseInt(license.Users, 10);
    if (!licensedUsers || licensedUsers === 0) {
        return null;
    }
    const percentUsed = (totalUsers / licensedUsers) * 100;

    let mode: 'success' | 'info' | 'danger' = 'info';
    let title: React.ReactNode = null;
    let message: React.ReactNode = null;

    if (percentUsed >= 90 && percentUsed < 95) {
        mode = 'success';
        title = (
            <FormattedMessage
                id='admin.license.userSeatAlert.successTitle'
                defaultMessage='Your workspace has reached 90% of your licensed seats'
            />
        );
        message = (
            <FormattedMessage
                id='admin.license.userSeatAlert.successMessage'
                defaultMessage='Congratulations! Platform adoption is strong across your organization. To ensure uninterrupted growth, our team can assist in scaling your license to meet operational requirements.'
            />
        );
    } else if (percentUsed >= 95 && percentUsed < 100) {
        mode = 'info';
        title = (
            <FormattedMessage
                id='admin.license.userSeatAlert.infoTitle'
                defaultMessage='Your workspace has reached 95% of your licensed seats'
            />
        );
        message = (
            <FormattedMessage
                id='admin.license.userSeatAlert.infoMessage'
                defaultMessage='Your organization is approaching full license utilization. Now is a good time to assess future needs and align usage with procurement planning. Contact us to explore available options.'
            />
        );
    } else if (percentUsed >= 100) {
        mode = 'danger';
        title = (
            <FormattedMessage
                id='admin.license.userSeatAlert.dangerTitle'
                defaultMessage='Your workspace has reached 100% of your licensed seats'
            />
        );
        message = (
            <FormattedMessage
                id='admin.license.userSeatAlert.dangerMessage'
                defaultMessage='All licensed seats are now in use. Additional users may result in true-up charges at your next renewal. To maintain compliance and uninterrupted access, you may limit new sign-ups, or contact us to extend your license.'
            />
        );
    }

    const actionButtonLeft = (
        <ExternalLink
            href={CONTACT_SALES_URL}
            location='license_settings_user_seat_alert'
            className='style-button AlertBanner__buttonLeft'
        >
            <FormattedMessage
                id='admin.license.userSeatAlert.contactSales'
                defaultMessage='Contact Sales'
            />
        </ExternalLink>
    );

    return (
        <AlertBanner
            mode={mode}
            title={title}
            message={message}
            actionButtonLeft={actionButtonLeft}
            onDismiss={() => setVisible(false)}
            closeBtnTooltip={formatMessage({id: 'admin.license.userSeatAlert.closeBtnTooltip', defaultMessage: 'Dismiss'})}
        />
    );
};

export default UserSeatAlertBanner;
