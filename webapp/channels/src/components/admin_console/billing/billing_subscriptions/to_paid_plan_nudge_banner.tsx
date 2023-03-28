// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl, FormattedMessage} from 'react-intl';
import moment from 'moment';

import AlertBanner from 'components/alert_banner';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {getSubscriptionProduct as selectSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import {AnnouncementBarTypes, CloudBanners, CloudProducts, Preferences} from 'utils/constants';
import {t} from 'utils/i18n';

import {GlobalState} from '@mattermost/types/store';

import './to_paid_plan_nudge_banner.scss';

// make range a string
// > 90
// 90 - 60
// 60 - 30
// 30 - 10
// < 10

const cloudFreeCloseMoment = '20230420';

interface ToPaidPlanDismissPreference {
    dismissRange: number;
    show: boolean;
}

export const ToPaidPlanBannerDismissable = () => {
    const dispatch = useDispatch();

    const openPricingModal = useOpenPricingModal();

    const currentUser = useSelector(getCurrentUser);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const product = useSelector(selectSubscriptionProduct);
    const currentProductStarter = product?.sku === CloudProducts.STARTER;

    const now = moment(Date.now());
    const cloudFreeEndDate = moment(cloudFreeCloseMoment, 'YYYYMMDD');
    const daysToCloudFreeEnd = cloudFreeEndDate.diff(now, 'days');

    const snoozePreferenceVal = useSelector((state: GlobalState) => getPreference(state, Preferences.TO_PAID_PLAN_NUDGE, CloudBanners.NUDGE_TO_PAID_PLAN_SNOOZED, '{"dismissRange": 0, "show": true}'));
    const snoozeInfo = JSON.parse(snoozePreferenceVal) as ToPaidPlanDismissPreference;
    const show = snoozeInfo.show;

    useEffect(() => {
        if (daysToCloudFreeEnd >= 90 && snoozeInfo.dismissRange !== 90) {
            snoozeBanner(true);
        }

        if (daysToCloudFreeEnd <= 30 && daysToCloudFreeEnd > 10 && snoozeInfo.dismissRange !== 30) {
            snoozeBanner(true);
        }

        if (daysToCloudFreeEnd <= 10 && daysToCloudFreeEnd > 0 && snoozeInfo.dismissRange !== 10) {
            snoozeBanner(true);
        }
    }, []);

    const snoozeBanner = (show = false) => {
        let dRange = 0;
        if (daysToCloudFreeEnd >= 90) {
            dRange = 90;
        }

        if (daysToCloudFreeEnd < 90 && daysToCloudFreeEnd > 60) {
            dRange = 90;
        }

        if (daysToCloudFreeEnd <= 60 && daysToCloudFreeEnd > 30) {
            dRange = 60;
        }

        if (daysToCloudFreeEnd <= 30 && daysToCloudFreeEnd > 10) {
            dRange = 30;
        }

        if (daysToCloudFreeEnd <= 10 && daysToCloudFreeEnd > 0) {
            dRange = 10;
        }

        const snoozeInfo: ToPaidPlanDismissPreference = {
            dismissRange: dRange,
            show,
        };

        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.TO_PAID_PLAN_NUDGE,
            name: CloudBanners.NUDGE_TO_PAID_PLAN_SNOOZED,
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

    if (!currentProductStarter) {
        return null;
    }

    const message = {
        id: 'cloud_billing.nudge_to_paid.announcement_bar',
        defaultMessage: 'Cloud Free will be deprecated on {date}. To keep your workspace, upgrade to a paid plan',
        values: {
            date: moment(cloudFreeCloseMoment, 'YYYYMMDD').format('MMMM DD, YYYY'),
        },
    };

    const announcementType = (daysToCloudFreeEnd < 10) ? AnnouncementBarTypes.CRITICAL : AnnouncementBarTypes.ANNOUNCEMENT;

    return (
        <AnnouncementBar
            type={announcementType}
            showCloseButton={daysToCloudFreeEnd > 10}
            onButtonClick={() => openPricingModal()}
            modalButtonText={t('cloud_billing.nudge_to_paid.view_plans')}
            modalButtonDefaultText='View plans'
            message={<FormattedMessage {...message}/>}
            showLinkAsButton={true}
            handleClose={snoozeBanner}
        />
    );
};

export const ToPaidNudgeBanner = () => {
    const {formatMessage} = useIntl();

    const [openSalesLink] = useOpenSalesLink();
    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const product = useSelector(selectSubscriptionProduct);
    const currentProductStarter = product?.sku === CloudProducts.STARTER;

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
            defaultMessage='Cloud Starter will be deprecated in {days} days. Upgrade to a paid plan or contact sales.'
            values={{days: daysToCloudFreeEnd}}
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

    return (
        <AlertBanner
            mode='info'
            title={title}
            message={description}
            className='ToYearlyNudgeBanner'
            actionButtonLeft={viewPlansAction}
            actionButtonRight={contactSalesAction}
        />
    );
};
