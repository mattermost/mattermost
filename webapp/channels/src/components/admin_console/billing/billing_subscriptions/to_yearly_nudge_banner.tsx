// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import moment from 'moment';
import React, {useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getSubscriptionProduct as selectSubscriptionProduct, getCloudSubscription as selectCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AlertBanner from 'components/alert_banner';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {AnnouncementBarTypes, CloudBanners, CloudProducts, Preferences, RecurringIntervals, CloudBillingTypes} from 'utils/constants';
import {t} from 'utils/i18n';

import './to_yearly_nudge_banner.scss';

enum DismissShowRange {
    GreaterThanEqual90 = '>=90',
    BetweenNinetyAnd60 = '89-61',
    SixtyTo31 = '60-31',
    ThirtyTo11 = '30-11',
    TenTo1 = '10-1',
    Zero = '0'
}

const cloudProMonthlyCloseMoment = '20230727';

interface ToYearlyPlanDismissPreference {

    // range represents the range for the days to the deprecation of cloud free e.g. in 30 to 10 days to deprecate cloud free
    // Incase of dismissing the banner, range represents the time (days) period when this banner was dismissed.
    // This is important because in case the banner was dismissed for a certain period, it helps us know that we should not show it again for that period.
    range: DismissShowRange;
    show: boolean;
}

const ToYearlyNudgeBannerDismissable = () => {
    const dispatch = useDispatch();

    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const snoozePreferenceVal = useSelector((state: GlobalState) => getPreference(state, Preferences.TO_CLOUD_YEARLY_PLAN_NUDGE, CloudBanners.NUDGE_TO_CLOUD_YEARLY_PLAN_SNOOZED, '{"range": 0, "show": true}'));
    const snoozeInfo = JSON.parse(snoozePreferenceVal) as ToYearlyPlanDismissPreference;
    const show = snoozeInfo.show;

    const currentUser = useSelector(getCurrentUser);
    const subscription = useSelector(selectCloudSubscription);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const product = useSelector(selectSubscriptionProduct);
    const currentProductProfessional = product?.sku === CloudProducts.PROFESSIONAL;
    const currentProductIsMonthly = product?.recurring_interval === RecurringIntervals.MONTH;
    const currentProductProMonthly = currentProductProfessional && currentProductIsMonthly;

    const now = moment(Date.now());
    const proMonthlyEndDate = moment(cloudProMonthlyCloseMoment, 'YYYYMMDD');
    const daysToProMonthlyEnd = proMonthlyEndDate.diff(now, 'days');

    const snoozedForRange = (range: DismissShowRange) => {
        return snoozeInfo.range === range;
    };

    useEffect(() => {
        if (!snoozeInfo.show) {
            if (daysToProMonthlyEnd >= 90 && !snoozedForRange(DismissShowRange.GreaterThanEqual90)) {
                showBanner(true);
            }

            if (daysToProMonthlyEnd < 90 && daysToProMonthlyEnd > 60 && !snoozedForRange(DismissShowRange.BetweenNinetyAnd60)) {
                showBanner(true);
            }

            if (daysToProMonthlyEnd <= 60 && daysToProMonthlyEnd > 30 && !snoozedForRange(DismissShowRange.SixtyTo31)) {
                showBanner(true);
            }

            if (daysToProMonthlyEnd <= 30 && daysToProMonthlyEnd > 10 && !snoozedForRange(DismissShowRange.ThirtyTo11)) {
                showBanner(true);
            }

            if (daysToProMonthlyEnd <= 10) {
                showBanner(true);
            }
        }
    }, []);

    const showBanner = (show = false) => {
        let dRange = DismissShowRange.Zero;
        if (daysToProMonthlyEnd >= 90) {
            dRange = DismissShowRange.GreaterThanEqual90;
        }

        if (daysToProMonthlyEnd < 90 && daysToProMonthlyEnd > 60) {
            dRange = DismissShowRange.BetweenNinetyAnd60;
        }

        if (daysToProMonthlyEnd <= 60 && daysToProMonthlyEnd > 30) {
            dRange = DismissShowRange.SixtyTo31;
        }

        if (daysToProMonthlyEnd <= 30 && daysToProMonthlyEnd > 10) {
            dRange = DismissShowRange.ThirtyTo11;
        }

        // ideally this case should not happen because snooze button is not shown when TenTo1 days are remaining
        if (daysToProMonthlyEnd <= 10 && daysToProMonthlyEnd > 0) {
            dRange = DismissShowRange.TenTo1;
        }

        const snoozeInfo: ToYearlyPlanDismissPreference = {
            range: dRange,
            show,
        };

        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.TO_CLOUD_YEARLY_PLAN_NUDGE,
            name: CloudBanners.NUDGE_TO_CLOUD_YEARLY_PLAN_SNOOZED,
            user_id: currentUser.id,
            value: JSON.stringify(snoozeInfo),
        }]));
    };

    if (!show) {
        return null;
    }

    if (!isAdmin) {
        return null;
    }

    if (!currentProductProMonthly) {
        return null;
    }

    if (subscription?.billing_type === CloudBillingTypes.INTERNAL || subscription?.billing_type === CloudBillingTypes.LICENSED) {
        return null;
    }

    const message = (
        <FormattedMessage
            id='cloud_billing.nudge_to_yearly.announcement_bar'
            defaultMessage='Monthly billing will be discontinued in {days} days . Switch to annual billing'
            values={{
                days: daysToProMonthlyEnd,

            }}
        />
    );

    const announcementType = (daysToProMonthlyEnd <= 10) ? AnnouncementBarTypes.CRITICAL : AnnouncementBarTypes.ANNOUNCEMENT;

    return (
        <AnnouncementBar
            id='cloud-pro-monthly-deprecation-announcement-bar'
            type={announcementType}
            showCloseButton={daysToProMonthlyEnd > 10}
            onButtonClick={() => openPurchaseModal({trackingLocation: 'to_yearly_nudge_annoucement_bar'})}
            modalButtonText={t('cloud_billing.nudge_to_yearly.update_billing')}
            modalButtonDefaultText='Update billing'
            message={message}
            showLinkAsButton={true}
            handleClose={showBanner}
        />
    );
};

const ToYearlyNudgeBanner = () => {
    const {formatMessage} = useIntl();

    const [openSalesLink] = useOpenSalesLink();
    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const subscription = useSelector(selectCloudSubscription);
    const product = useSelector(selectSubscriptionProduct);
    const currentProductProfessional = product?.sku === CloudProducts.PROFESSIONAL;
    const currentProductIsMonthly = product?.recurring_interval === RecurringIntervals.MONTH;
    const currentProductProMonthly = currentProductProfessional && currentProductIsMonthly;

    if (!currentProductProMonthly) {
        return null;
    }

    if (subscription?.billing_type === CloudBillingTypes.INTERNAL || subscription?.billing_type === CloudBillingTypes.LICENSED) {
        return null;
    }

    const now = moment(Date.now());
    const proMonthlyEndDate = moment(cloudProMonthlyCloseMoment, 'YYYYMMDD');
    const daysToProMonthlyEnd = proMonthlyEndDate.diff(now, 'days');

    const title = (
        <FormattedMessage
            id='cloud_billing.nudge_to_yearly.title'
            defaultMessage='Action required: Switch to annual billing to keep your workspace.'
        />
    );

    const description = (
        <FormattedMessage
            id='cloud_billing.nudge_to_yearly.description'
            defaultMessage='Monthly billing will be discontinued on {date}. To keep your workspace, switch to annual billing.'
            values={{date: moment(cloudProMonthlyCloseMoment, 'YYYYMMDD').format('MMMM DD, YYYY')}}
        />
    );

    const viewPlansAction = (
        <button
            onClick={() => openPurchaseModal({trackingLocation: 'to_yearly_nudge_banner'})}
            className='btn ToYearlyNudgeBanner__primary'
        >
            {formatMessage({id: 'cloud_billing.nudge_to_yearly.learn_more', defaultMessage: 'Learn more'})}
        </button>
    );

    const contactSalesAction = (
        <button
            onClick={openSalesLink}
            className='btn ToYearlyNudgeBanner__secondary'
        >
            {formatMessage({id: 'cloud_billing.nudge_to_yearly.contact_sales', defaultMessage: 'Contact sales'})}
        </button>
    );

    const bannerMode = (daysToProMonthlyEnd <= 10) ? 'danger' : 'info';

    return (
        <AlertBanner
            id='cloud-pro-monthly-deprecation-alert-banner'
            mode={bannerMode}
            title={title}
            message={description}
            className='ToYearlyNudgeBanner'
            actionButtonLeft={viewPlansAction}
            actionButtonRight={contactSalesAction}
        />
    );
};

export {
    ToYearlyNudgeBanner,
    ToYearlyNudgeBannerDismissable,
};
