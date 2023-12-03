// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {useDelinquencySubscription} from 'components/common/hooks/useDelinquencySubscription';
import useGetSubscription from 'components/common/hooks/useGetSubscription';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';

import {daysToExpiration} from 'utils/cloud_utils';
import {Preferences, AnnouncementBarTypes, CloudBanners} from 'utils/constants';

import type {GlobalState} from 'types/store';

import AnnouncementBar from '../default_announcement_bar';

const between = (x: number, min: number, max: number) => {
    return x >= min && x <= max;
};

export const getCurrentYearAsString = () => {
    const now = new Date();
    const year = now.getFullYear();
    return year.toString();
};

const CloudAnnualRenewalAnnouncementBar = () => {
    const subscription = useGetSubscription();

    // TODO: Update with renewal modal
    const openPurchaseModal = useOpenCloudPurchaseModal({});
    const {formatMessage} = useIntl();
    const {isDelinquencySubscription} = useDelinquencySubscription();
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);
    const hasDismissed60DayBanner = useSelector((state: GlobalState) => get(state, Preferences.CLOUD_ANNUAL_RENEWAL_BANNER, `${CloudBanners.ANNUAL_RENEWAL_60_DAY}_${getCurrentYearAsString()}`)) === 'true';
    const hasDismissed30DayBanner = useSelector((state: GlobalState) => get(state, Preferences.CLOUD_ANNUAL_RENEWAL_BANNER, `${CloudBanners.ANNUAL_RENEWAL_30_DAY}_${getCurrentYearAsString()}`)) === 'true';
    const cloudAnnualRenewalsEnabled = useSelector(getConfig).FeatureFlags?.CloudAnnualRenewals;

    const daysUntilExpiration = useMemo(() => {
        if (!subscription || !subscription.end_at || !subscription.cancel_at) {
            return 0;
        }

        return daysToExpiration(subscription.end_at * 1000);
    }, [subscription]);

    const handleDismiss = (banner: string) => {
        // We store the preference name with the current year as a string appended to the end,
        // so that next renewal period we can show the banner again despite the user having dismissed it in the previous year
        dispatch(savePreferences(currentUserId, [{
            category: Preferences.CLOUD_ANNUAL_RENEWAL_BANNER,
            name: `${banner}_${getCurrentYearAsString()}`,
            user_id: currentUserId,
            value: 'true',
        }]));
    };

    const getBanner = useMemo(() => {
        const defaultProps = {
            showLinkAsButton: true,
            isTallBanner: true,
            icon: <i className='icon icon-alert-outline'/>,
            modalButtonText: formatMessage({id: 'cloud_annual_renewal.banner.buttonText.renew', defaultMessage: 'Renew'}),
            modalButtonDefaultText: 'Renew',
            message: <></>,
            onButtonClick: openPurchaseModal,
            handleClose: () => { },
            showCloseButton: true,
        };
        let bannerProps = {
            ...defaultProps,
            type: '',
        };
        if (between(daysUntilExpiration, 31, 60) && !hasDismissed60DayBanner) {
            if (hasDismissed60DayBanner) {
                return null;
            }
            bannerProps = {
                ...defaultProps,
                message: (<>{formatMessage({id: 'cloud_annual_renewal.banner.message.60', defaultMessage: 'Your annual subscription expires in {days} days. Please renew to avoid any disruption.'}, {days: daysUntilExpiration})}</>),
                icon: (<InformationOutlineIcon size={18}/>),
                type: AnnouncementBarTypes.ANNOUNCEMENT,
                handleClose: () => handleDismiss(CloudBanners.ANNUAL_RENEWAL_60_DAY),
            };
        } else if (between(daysUntilExpiration, 8, 30)) {
            if (hasDismissed30DayBanner) {
                return null;
            }
            bannerProps = {
                ...defaultProps,
                message: (<>{formatMessage({id: 'cloud_annual_renewal.banner.message.30', defaultMessage: 'Your annual subscription expires in {days} days. Please renew to avoid any disruption.'}, {days: daysUntilExpiration})}</>),
                icon: (<InformationOutlineIcon size={18}/>),
                type: AnnouncementBarTypes.ADVISOR,
                handleClose: () => handleDismiss(CloudBanners.ANNUAL_RENEWAL_30_DAY),
            };
        } else if (between(daysUntilExpiration, 0, 7) && !isDelinquencySubscription()) {
            bannerProps = {
                ...defaultProps,
                message: (<>{formatMessage({id: 'cloud_annual_renewal.banner.message.7', defaultMessage: 'Your annual subscription expires in {days} days. Failure to renew will result in your workspace being deleted.'}, {days: daysUntilExpiration})}</>),
                icon: (<i className='icon icon-alert-outline'/>),
                type: AnnouncementBarTypes.CRITICAL,
                showCloseButton: false,
            };
        }

        return <AnnouncementBar {...bannerProps}/>;
    }, [daysUntilExpiration, hasDismissed60DayBanner, hasDismissed30DayBanner]);

    // Delinquent subscriptions will have a cancel_at time, but the banner is handled separately
    if (!cloudAnnualRenewalsEnabled || !subscription || !subscription.cancel_at || subscription.will_renew === 'true' || isDelinquencySubscription() || !isAdmin || daysUntilExpiration > 60) {
        return null;
    }

    return (
        <>
            {getBanner}
        </>
    );
};

export default CloudAnnualRenewalAnnouncementBar;
