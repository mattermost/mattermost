// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import moment from 'moment';
import React, {useEffect} from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getSubscriptionProduct as selectSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {deprecateCloudFree, get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import AlertBanner from 'components/alert_banner';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';

import {AnnouncementBarTypes, CloudBanners, CloudProducts, Preferences} from 'utils/constants';
import {t} from 'utils/i18n';

import './to_paid_plan_nudge_banner.scss';

enum DismissShowRange {
    GreaterThanEqual90 = '>=90',
    BetweenNinetyAnd60 = '89-61',
    SixtyTo31 = '60-31',
    ThirtyTo11 = '30-11',
    TenTo1 = '10-1',
    Zero = '0'
}

const cloudFreeCloseMoment = '20230727';

interface ToPaidPlanDismissPreference {

    // range represents the range for the days to the deprecation of cloud free e.g. in 30 to 10 days to deprecate cloud free
    // Incase of dismissing the banner, range represents the time (days) period when this banner was dismissed.
    // This is important because in case the banner was dismissed for a certain period, it helps us know that we should not show it again for that period.
    range: DismissShowRange;
    show: boolean;
}

export const ToPaidPlanBannerDismissable = () => {
    const dispatch = useDispatch();

    const openPricingModal = useOpenPricingModal();

    const currentUser = useSelector(getCurrentUser);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const product = useSelector(selectSubscriptionProduct);
    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
    const currentProductStarter = product?.sku === CloudProducts.STARTER;

    const now = moment(Date.now());
    const cloudFreeEndDate = moment(cloudFreeCloseMoment, 'YYYYMMDD');
    const daysToCloudFreeEnd = cloudFreeEndDate.diff(now, 'days');

    const snoozePreferenceVal = useSelector((state: GlobalState) => getPreference(state, Preferences.TO_PAID_PLAN_NUDGE, CloudBanners.NUDGE_TO_PAID_PLAN_SNOOZED, '{"range": 0, "show": true}'));
    const snoozeInfo = JSON.parse(snoozePreferenceVal) as ToPaidPlanDismissPreference;
    const show = snoozeInfo.show;

    const snoozedForRange = (range: DismissShowRange) => {
        return snoozeInfo.range === range;
    };

    useEffect(() => {
        if (!snoozeInfo.show) {
            if (daysToCloudFreeEnd >= 90 && !snoozedForRange(DismissShowRange.GreaterThanEqual90)) {
                showBanner(true);
            }

            if (daysToCloudFreeEnd < 90 && daysToCloudFreeEnd > 60 && !snoozedForRange(DismissShowRange.BetweenNinetyAnd60)) {
                showBanner(true);
            }

            if (daysToCloudFreeEnd <= 60 && daysToCloudFreeEnd > 30 && !snoozedForRange(DismissShowRange.SixtyTo31)) {
                showBanner(true);
            }

            if (daysToCloudFreeEnd <= 30 && daysToCloudFreeEnd > 10 && !snoozedForRange(DismissShowRange.ThirtyTo11)) {
                showBanner(true);
            }

            if (daysToCloudFreeEnd <= 10) {
                showBanner(true);
            }
        }
    }, []);

    const showBanner = (show = false) => {
        let dRange = DismissShowRange.Zero;
        if (daysToCloudFreeEnd >= 90) {
            dRange = DismissShowRange.GreaterThanEqual90;
        }

        if (daysToCloudFreeEnd < 90 && daysToCloudFreeEnd > 60) {
            dRange = DismissShowRange.BetweenNinetyAnd60;
        }

        if (daysToCloudFreeEnd <= 60 && daysToCloudFreeEnd > 30) {
            dRange = DismissShowRange.SixtyTo31;
        }

        if (daysToCloudFreeEnd <= 30 && daysToCloudFreeEnd > 10) {
            dRange = DismissShowRange.ThirtyTo11;
        }

        // ideally this case should not happen because snooze button is not shown when TenTo1 days are remaining
        if (daysToCloudFreeEnd <= 10 && daysToCloudFreeEnd > 0) {
            dRange = DismissShowRange.TenTo1;
        }

        const snoozeInfo: ToPaidPlanDismissPreference = {
            range: dRange,
            show,
        };

        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.TO_PAID_PLAN_NUDGE,
            name: CloudBanners.NUDGE_TO_PAID_PLAN_SNOOZED,
            user_id: currentUser.id,
            value: JSON.stringify(snoozeInfo),
        }]));
    };

    if (!cloudFreeDeprecated) {
        return null;
    }

    if (!show) {
        return null;
    }

    if (!isAdmin) {
        return null;
    }

    if (!currentProductStarter) {
        return null;
    }

    let message = {
        id: 'cloud_billing.nudge_to_paid.announcement_bar',
        defaultMessage: 'Cloud Free will be deprecated on {date}. To keep your workspace, upgrade to a paid plan',
        values: {
            date: moment(cloudFreeCloseMoment, 'YYYYMMDD').format('MMMM DD, YYYY'),
        },
    };

    if (daysToCloudFreeEnd < 0) {
        message = {
            id: 'cloud_billing.nudge_to_paid.announcement_bar_deprecated',
            defaultMessage: 'Cloud Free was deprecated. To keep your workspace, upgrade to a paid plan',
        } as any;
    }

    const announcementType = (daysToCloudFreeEnd <= 10) ? AnnouncementBarTypes.CRITICAL : AnnouncementBarTypes.ANNOUNCEMENT;

    return (
        <AnnouncementBar
            id='cloud-free-deprecation-announcement-bar'
            type={announcementType}
            showCloseButton={daysToCloudFreeEnd > 10}
            onButtonClick={openPricingModal}
            modalButtonText={t('cloud_billing.nudge_to_paid.view_plans')}
            modalButtonDefaultText='View plans'
            message={<FormattedMessage {...message}/>}
            showLinkAsButton={true}
            handleClose={showBanner}
        />
    );
};

export const ToPaidNudgeBanner = () => {
    const {formatMessage} = useIntl();

    const [openSalesLink] = useOpenSalesLink();
    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const product = useSelector(selectSubscriptionProduct);
    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
    const currentProductStarter = product?.sku === CloudProducts.STARTER;

    if (!cloudFreeDeprecated) {
        return null;
    }

    if (!currentProductStarter) {
        return null;
    }

    const now = moment(Date.now());
    const cloudFreeEndDate = moment(cloudFreeCloseMoment, 'YYYYMMDD');
    const daysToCloudFreeEnd = cloudFreeEndDate.diff(now, 'days');

    const title = (
        <FormattedMessage
            id='cloud_billing.nudge_to_paid.title'
            defaultMessage='Upgrade to paid plan to keep your workspace'
        />
    );

    const description = (
        <FormattedMessage
            id='cloud_billing.nudge_to_paid.description'
            defaultMessage='Cloud Free will be deprecated in {days} days. Upgrade to a paid plan or contact sales.'
            values={{days: daysToCloudFreeEnd < 0 ? 0 : daysToCloudFreeEnd}}
        />
    );

    const viewPlansAction = (
        <button
            onClick={() => openPurchaseModal({trackingLocation: 'to_paid_plan_nudge_banner'})}
            className='btn ToPaidNudgeBanner__primary'
        >
            {formatMessage({id: 'cloud_billing.nudge_to_paid.learn_more', defaultMessage: 'Upgrade'})}
        </button>
    );

    const contactSalesAction = (
        <button
            onClick={openSalesLink}
            className='btn ToPaidNudgeBanner__secondary'
        >
            {formatMessage({id: 'cloud_billing.nudge_to_paid.contact_sales', defaultMessage: 'Contact sales'})}
        </button>
    );

    const bannerMode = (daysToCloudFreeEnd <= 10) ? 'danger' : 'info';

    return (
        <AlertBanner
            id='cloud-free-deprecation-alert-banner'
            mode={bannerMode}
            title={title}
            message={description}
            className='ToYearlyNudgeBanner'
            actionButtonLeft={viewPlansAction}
            actionButtonRight={contactSalesAction}
        />
    );
};
