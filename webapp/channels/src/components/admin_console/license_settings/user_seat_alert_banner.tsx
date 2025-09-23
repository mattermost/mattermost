// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ClientLicense} from '@mattermost/types/config';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as selectPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import ExternalLink from 'components/external_link';

import {Preferences, LicenseLinks} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AlertBanner from '../../alert_banner';

export interface UserSeatAlertBannerProps {
    license: ClientLicense;
    totalUsers: number;
    location: 'license_settings' | 'system_statistics';
}

const UserSeatAlertBanner: React.FC<UserSeatAlertBannerProps> = ({license, totalUsers, location}) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentUser = useSelector(getCurrentUser);

    const getPreferenceName = (percentUsed: number) => {
        if (percentUsed < 90) {
            return '';
        }

        const locationSuffix = location === 'license_settings' ? 'license_settings' : 'system_statistics';
        if (percentUsed >= 100) {
            return `100_seat_${locationSuffix}`;
        } else if (percentUsed >= 95) {
            return `95_seat_${locationSuffix}`;
        }
        return `90_seat_${locationSuffix}`;
    };

    const calculatePercentUsed = () => {
        if (!license || !license.Users) {
            return 0;
        }
        const licensedUsers = parseInt(license.Users, 10);

        if (!licensedUsers || licensedUsers === 0) {
            return 0;
        }
        return (totalUsers / licensedUsers) * 100;
    };

    const percentUsed = calculatePercentUsed();
    const preferenceName = getPreferenceName(percentUsed);
    const dismissed = useSelector((state: GlobalState) => selectPreference(state, Preferences.CATEGORY_SYSTEM_NOTICE, preferenceName, 'false'));
    const [visible, setVisible] = useState(dismissed === 'false');

    useEffect(() => {
        setVisible(dismissed === 'false');
    }, [dismissed]);

    const handleDismiss = () => {
        setVisible(false);

        dispatch(savePreferences(currentUser.id, [{
            user_id: currentUser.id,
            category: Preferences.CATEGORY_SYSTEM_NOTICE,
            name: preferenceName,
            value: 'true',
        }]));
    };

    if (!visible || !license || !license.Users || percentUsed < 90) {
        return null;
    }

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
            href={LicenseLinks.CONTACT_SALES}
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
            onDismiss={handleDismiss}
            closeBtnTooltip={formatMessage({id: 'admin.license.userSeatAlert.closeBtnTooltip', defaultMessage: 'Dismiss'})}
        />
    );
};

export default UserSeatAlertBanner;
