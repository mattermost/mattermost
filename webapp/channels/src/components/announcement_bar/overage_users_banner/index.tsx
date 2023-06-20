// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {GlobalState} from 'types/store';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import {calculateOverageUserActivated} from 'utils/overage_team';
import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {PreferenceType} from '@mattermost/types/preferences';
import {useExpandOverageUsersCheck} from 'components/common/hooks/useExpandOverageUsersCheck';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import {StatTypes, Preferences, AnnouncementBarTypes, ConsolePages} from 'utils/constants';

import './overage_users_banner.scss';
import {getSiteURL} from 'utils/url';
import useCanSelfHostedExpand from 'components/common/hooks/useCanSelfHostedExpand';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';

type AdminHasDismissedItArgs = {
    preferenceName: string;
    overagePreferences: PreferenceType[];
    isWarningBanner: boolean;
}

const adminHasDismissed = ({preferenceName, overagePreferences, isWarningBanner}: AdminHasDismissedItArgs): boolean => {
    if (isWarningBanner) {
        return overagePreferences.find((value) => value.name === preferenceName) !== undefined;
    }

    return false;
};

const OverageUsersBanner = () => {
    const [openContactSales] = useOpenSalesLink();
    const dispatch = useDispatch();
    const stats = useSelector((state: GlobalState) => state.entities.admin.analytics) || {};
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const license = useSelector(getLicense);
    const seatsPurchased = parseInt(license.Users, 10);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const getPreferencesCategory = useMemo(makeGetCategory, []);
    const currentUser = useSelector((state: GlobalState) => getCurrentUser(state));
    const overagePreferences = useSelector((state: GlobalState) => getPreferencesCategory(state, Preferences.OVERAGE_USERS_BANNER));
    const activeUsers = ((stats || {})[StatTypes.TOTAL_USERS]) as number || 0;
    const {
        isBetween5PercerntAnd10PercentPurchasedSeats,
        isOver10PercerntPurchasedSeats,
    } = calculateOverageUserActivated({
        activeUsers,
        seatsPurchased,
    });
    const isSelfHostedExpansionEnabled = useSelector(getConfig)?.ServiceSettings?.SelfHostedPurchase;
    const canSelfHostedExpand = useCanSelfHostedExpand() && isSelfHostedExpansionEnabled;
    const siteURL = getSiteURL();
    const prefixPreferences = isOver10PercerntPurchasedSeats ? 'error' : 'warn';
    const prefixLicenseId = (license.Id || '').substring(0, 8);
    const preferenceName = `${prefixPreferences}_overage_seats_${prefixLicenseId}`;

    const overageByUsers = activeUsers - seatsPurchased;

    const isOverageState = isBetween5PercerntAnd10PercentPurchasedSeats || isOver10PercerntPurchasedSeats;
    const hasPermission = isAdmin && isOverageState && !isCloud;
    const {
        cta,
        expandableLink,
        trackEventFn,
        getRequestState,
        isExpandable,
    } = useExpandOverageUsersCheck({
        shouldRequest: hasPermission && !adminHasDismissed({isWarningBanner: isBetween5PercerntAnd10PercentPurchasedSeats, overagePreferences, preferenceName}),
        licenseId: license.Id,
        isWarningState: isBetween5PercerntAnd10PercentPurchasedSeats,
        banner: 'global banner',
        canSelfHostedExpand: canSelfHostedExpand || false,
    });

    const handleClose = () => {
        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.OVERAGE_USERS_BANNER,
            name: preferenceName,
            user_id: currentUser.id,
            value: 'Overage users banner watched',
        }]));
    };

    const handleUpdateSeatsSelfServeClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        trackEventFn('Self Serve');

        if (canSelfHostedExpand) {
            window.open(`${siteURL}/${ConsolePages.LICENSE}?action=show_expansion_modal`);
            return;
        }

        window.open(expandableLink(license.Id), '_blank');
    };

    const handleContactSalesClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        trackEventFn('Contact Sales');
        openContactSales();
    };

    const handleClick = isExpandable ? handleUpdateSeatsSelfServeClick : handleContactSalesClick;

    if (!hasPermission || adminHasDismissed({isWarningBanner: isBetween5PercerntAnd10PercentPurchasedSeats, overagePreferences, preferenceName})) {
        return null;
    }

    let message = (
        <FormattedMessage
            id='licensingPage.overageUsersBanner.text'
            defaultMessage='Your workspace user count has exceeded your paid license seat count by {seats, number} {seats, plural, one {seat} other {seats}}. Purchase additional seats to remain compliant.'
            values={{
                seats: overageByUsers,
            }}
        />);

    if (canSelfHostedExpand) {
        message = (
            <FormattedMessage
                id='licensingPage.overageUsersBanner.textSelfHostedExpand'
                defaultMessage='Your workspace user count has exceeded your paid license seat count. Update your seat count to stay compliant.'
                values={{
                    seats: overageByUsers,
                }}
            />);
    }

    return (
        <AnnouncementBar
            type={isBetween5PercerntAnd10PercentPurchasedSeats ? AnnouncementBarTypes.ADVISOR : AnnouncementBarTypes.CRITICAL}
            showCloseButton={isBetween5PercerntAnd10PercentPurchasedSeats}
            onButtonClick={handleClick}
            modalButtonText={cta}
            modalButtonDefaultText={cta}
            message={message}
            showLinkAsButton={true}
            isTallBanner={true}
            icon={<i className='icon icon-alert-outline'/>}
            handleClose={handleClose}
            showCTA={getRequestState !== 'IDLE' && getRequestState !== 'LOADING'}
        />
    );
};

export default OverageUsersBanner;
