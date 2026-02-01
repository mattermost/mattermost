// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getAdminAnalytics} from 'mattermost-redux/selectors/entities/admin';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getOverageBannerPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {
    getCurrentUser,
    isCurrentUserSystemAdmin,
} from 'mattermost-redux/selectors/entities/users';

import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import {useExpandOverageUsersCheck} from 'components/common/hooks/useExpandOverageUsersCheck';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {StatTypes, Preferences, AnnouncementBarTypes} from 'utils/constants';
import {calculateOverageUserActivated} from 'utils/overage_team';

import './overage_users_banner.scss';

type AdminHasDismissedItArgs = {
    preferenceName: string;
    overagePreferences: PreferenceType[];
};

function adminHasDismissed({
    preferenceName,
    overagePreferences,
}: AdminHasDismissedItArgs): boolean {
    return overagePreferences.some((pref) => pref.name === preferenceName);
}

function OverageUsersBanner(): React.ReactElement | null {
    const [openContactSales] = useOpenSalesLink();
    const dispatch = useDispatch();

    const stats = useSelector(getAdminAnalytics);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const license = useSelector(getLicense);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const currentUser = useSelector(getCurrentUser);
    const overagePreferences = useSelector(getOverageBannerPreferences);
    const {cta} = useExpandOverageUsersCheck();

    const seatsPurchased = parseInt(license?.Users ?? '0', 10);
    const activeUsers = (stats?.[StatTypes.TOTAL_USERS] as number) || 0;

    const {
        isBetween5PercerntAnd10PercentPurchasedSeats,
        isOver10PercerntPurchasedSeats,
    } = calculateOverageUserActivated({
        activeUsers,
        seatsPurchased,
    });

    const prefixPreferences = isOver10PercerntPurchasedSeats ? 'error' : 'warn';
    const prefixLicenseId = license?.Id?.substring(0, 8) ?? '';
    const preferenceName = `${prefixPreferences}_overage_seats_${prefixLicenseId}`;

    const overageByUsers = activeUsers - seatsPurchased;
    const isOverageState =
        overageByUsers > 0 &&
        (isBetween5PercerntAnd10PercentPurchasedSeats ||
            isOver10PercerntPurchasedSeats);
    const hasPermission = isAdmin && isOverageState && !isCloud;

    const handleClose = (): void => {
        if (currentUser?.id) {
            dispatch(
                savePreferences(currentUser.id, [
                    {
                        category: Preferences.OVERAGE_USERS_BANNER,
                        name: preferenceName,
                        user_id: currentUser.id,
                        value: 'Overage users banner watched',
                    },
                ]),
            );
        }
    };

    const handleContactSalesClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ): void => {
        e.preventDefault();
        openContactSales();
    };

    if (!hasPermission || adminHasDismissed({overagePreferences, preferenceName})) {
        return null;
    }

    const message = (
        <FormattedMessage
            id='licensingPage.overageUsersBanner.text'
            defaultMessage='(Only visible to admins) The user count exceeds the number of licensed seats by {seats, number} {seats, plural, one {seat} other {seats}}. Purchase more seats to stay compliant.'
            values={{
                seats: overageByUsers,
            }}
        />
    );

    return (
        <AnnouncementBar
            type={
                isBetween5PercerntAnd10PercentPurchasedSeats ? AnnouncementBarTypes.ADVISOR : AnnouncementBarTypes.CRITICAL
            }
            showCloseButton={true}
            onButtonClick={handleContactSalesClick}
            modalButtonText={cta}
            message={message}
            showLinkAsButton={true}
            isTallBanner={true}
            icon={<i className='icon icon-alert-outline'/>}
            handleClose={handleClose}
        />
    );
}

export default OverageUsersBanner;
