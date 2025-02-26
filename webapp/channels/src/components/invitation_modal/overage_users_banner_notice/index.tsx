// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getOverageBannerPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AlertBanner from 'components/alert_banner';
import {useExpandOverageUsersCheck} from 'components/common/hooks/useExpandOverageUsersCheck';
import ExternalLink from 'components/external_link';

import {LicenseLinks, StatTypes, Preferences} from 'utils/constants';
import {getIsGovSku} from 'utils/license_utils';
import {calculateOverageUserActivated} from 'utils/overage_team';

import type {GlobalState} from 'types/store';

import './overage_users_banner_notice.scss';

type AdminHasDismissedArgs = {
    preferenceName: string;
    overagePreferences: PreferenceType[];
}

const adminHasDismissed = ({preferenceName, overagePreferences}: AdminHasDismissedArgs): boolean => {
    return overagePreferences.find((value) => value.name === preferenceName) !== undefined;
};

const OverageUsersBannerNotice = () => {
    const dispatch = useDispatch();
    const stats = useSelector((state: GlobalState) => state.entities.admin.analytics) || {};
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const license = useSelector(getLicense);
    const isGovSku = getIsGovSku(license);
    const seatsPurchased = parseInt(license.Users, 10);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const overagePreferences = useSelector(getOverageBannerPreferences);
    const activeUsers = ((stats || {})[StatTypes.TOTAL_USERS]) as number || 0;

    const {
        isBetween5PercerntAnd10PercentPurchasedSeats,
        isOver10PercerntPurchasedSeats,
    } = calculateOverageUserActivated({
        activeUsers,
        seatsPurchased,
    });
    const prefixPreferences = isOver10PercerntPurchasedSeats ? 'error' : 'warn';
    const prefixLicenseId = (license.Id || '').substring(0, 8);
    const preferenceName = `${prefixPreferences}_overage_seats_${prefixLicenseId}`;

    const overageByUsers = activeUsers - seatsPurchased;
    const isOverageState = isBetween5PercerntAnd10PercentPurchasedSeats || isOver10PercerntPurchasedSeats;
    const hasPermission = isAdmin && isOverageState && !isCloud;
    const {
        cta,
        trackEventFn,
    } = useExpandOverageUsersCheck({
        isWarningState: isBetween5PercerntAnd10PercentPurchasedSeats,
        banner: 'invite modal',
    });

    if (!hasPermission || adminHasDismissed({overagePreferences, preferenceName})) {
        return null;
    }

    const handleDismiss = () => {
        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.OVERAGE_USERS_BANNER,
            name: preferenceName,
            user_id: currentUser.id,
            value: 'Overage users banner watched',
        }]));
    };

    let message;

    if (!isGovSku) {
        message = (
            <FormattedMessage
                id='licensingPage.overageUsersBanner.noticeDescription'
                defaultMessage='Notify your Customer Success Manager on your next true-up check. <a></a>'
                values={{
                    a: () => {
                        const handleClick = () => {
                            trackEventFn('Contact Sales');
                        };

                        return (
                            <ExternalLink
                                location='overage_users_banner'
                                className='overage_users_banner__button'
                                href={LicenseLinks.CONTACT_SALES}
                                onClick={handleClick}
                            >
                                <FormattedMessage {...cta}/>
                            </ExternalLink>
                        );
                    },
                }}
            >
                {(text) => <p className='overage_users_banner__description'>{text}</p>}
            </FormattedMessage>
        );
    }

    return (
        <AlertBanner
            mode={isOver10PercerntPurchasedSeats ? 'danger' : 'warning'}
            onDismiss={handleDismiss}
            className='overage_users_banner'
            title={
                <FormattedMessage
                    id='licensingPage.overageUsersBanner.noticeTitle'
                    defaultMessage='Your workspace user count has exceeded your paid license seat count by {seats, number} {seats, plural, one {seat} other {seats}}'
                    values={{
                        seats: overageByUsers,
                    }}
                />
            }
            message={message}
        />
    );
};

export default OverageUsersBannerNotice;
