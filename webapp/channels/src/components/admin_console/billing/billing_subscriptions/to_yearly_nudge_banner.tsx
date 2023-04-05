// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl, FormattedMessage} from 'react-intl';
import moment from 'moment';

import AlertBanner from 'components/alert_banner';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import AnnouncementBar from 'components/announcement_bar/default_announcement_bar';

import {getSubscriptionProduct as selectSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import {AnnouncementBarTypes, CloudBanners, CloudProducts, Preferences, RecurringIntervals} from 'utils/constants';
import {t} from 'utils/i18n';

import {GlobalState} from '@mattermost/types/store';

import './to_yearly_nudge_banner.scss';

const cloudProMonthlyCloseMoment = '20230415'; // TBD, final day of cloud PRO monthly

const ToYearlyNudgeBannerDismissable = () => {
    const dispatch = useDispatch();

    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const nudgeDismissed = useSelector((state: GlobalState) => getPreference(state, Preferences.CLOUD_YEARLY_NUDGE_BANNER, CloudBanners.NUDGE_TO_YEARLY_BANNER_DISMISSED)) === 'true';
    const currentUser = useSelector(getCurrentUser);
    const isAdmin = useSelector(isCurrentUserSystemAdmin);
    const product = useSelector(selectSubscriptionProduct);
    const currentProductProfessional = product?.sku === CloudProducts.PROFESSIONAL;
    const currentProductIsMonthly = product?.recurring_interval === RecurringIntervals.MONTH;
    const currentProductProMonthly = currentProductProfessional && currentProductIsMonthly;

    const now = moment(Date.now());
    const proMonthlyEndDate = moment(cloudProMonthlyCloseMoment, 'YYYYMMDD');
    const daysToProMonthlyEnd = proMonthlyEndDate.diff(now, 'days');

    const savedDismissedPref = () => {
        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.CLOUD_YEARLY_NUDGE_BANNER,
            name: CloudBanners.NUDGE_TO_YEARLY_BANNER_DISMISSED,
            user_id: currentUser.id,
            value: 'true',
        }]));
    };

    if (nudgeDismissed) {
        return null;
    }

    if (!isAdmin) {
        return null;
    }

    if (!currentProductProMonthly) {
        return null;
    }

    const message = {
        id: 'cloud_billing.nudge_to_yearly.announcement_bar',
        defaultMessage: 'Monthly billing will be discontinued in {days} days . Switch to annual billing',
        values: {
            days: daysToProMonthlyEnd,
        },
    };

    const announcementType = (daysToProMonthlyEnd <= 10) ? AnnouncementBarTypes.CRITICAL : AnnouncementBarTypes.ANNOUNCEMENT;

    return (
        <AnnouncementBar
            type={announcementType}
            showCloseButton={false}
            onButtonClick={() => openPurchaseModal({trackingLocation: 'to_yearly_nudge_annoucement_bar'})}
            modalButtonText={t('cloud_billing.nudge_to_yearly.learn_more')}
            modalButtonDefaultText='Learn more'
            message={<FormattedMessage {...message}/>}
            showLinkAsButton={true}
            handleClose={savedDismissedPref}
        />
    );
};

const ToYearlyNudgeBanner = () => {
    const {formatMessage} = useIntl();

    const [openSalesLink] = useOpenSalesLink();
    const openPurchaseModal = useOpenCloudPurchaseModal({});

    const product = useSelector(selectSubscriptionProduct);
    const currentProductProfessional = product?.sku === CloudProducts.PROFESSIONAL;
    const currentProductIsMonthly = product?.recurring_interval === RecurringIntervals.MONTH;
    const currentProductProMonthly = currentProductProfessional && currentProductIsMonthly;

    if (!currentProductProMonthly) {
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
