// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getSubscriptionProduct} from 'mattermost-redux/selectors/entities/cloud';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {trackEvent} from 'actions/telemetry_actions';

import {useDelinquencySubscription} from 'components/common/hooks/useDelinquencySubscription';
import {NotifyStatus, useGetNotifyAdmin} from 'components/common/hooks/useGetNotifyAdmin';

import {
    AnnouncementBarTypes, CloudProducts, CloudProductToSku, MattermostFeatures, Preferences, TELEMETRY_CATEGORIES,
} from 'utils/constants';
import {t} from 'utils/i18n';

import type {GlobalState} from 'types/store';

import AnnouncementBar from '../default_announcement_bar';

export const BannerPreferenceName = 'notify_upgrade_workspace_banner';

const NotifyAdminDowngradeDelinquencyBar = () => {
    const dispatch = useDispatch();
    const getCategory = makeGetCategory();
    const preferences = useSelector((state: GlobalState) =>
        getCategory(state, Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE),
    );
    const product = useSelector(getSubscriptionProduct);
    const currentUser = useSelector((state: GlobalState) =>
        getCurrentUser(state),
    );
    const {isDelinquencySubscriptionHigherThan90Days} = useDelinquencySubscription();

    const {notifyAdmin, notifyStatus} = useGetNotifyAdmin({});

    useEffect(() => {
        if (notifyStatus === NotifyStatus.Success) {
            dispatch(savePreferences(currentUser.id, [{
                category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
                name: BannerPreferenceName,
                user_id: currentUser.id,
                value: 'adminNotified',
            }]));
        }
    }, [currentUser, dispatch, notifyStatus]);

    const shouldShowBanner = () => {
        if (!isDelinquencySubscriptionHigherThan90Days()) {
            return false;
        }

        if (isSystemAdmin(currentUser.roles)) {
            return false;
        }

        if (!preferences) {
            return false;
        }

        if (preferences.some((pref) => pref.name === BannerPreferenceName)) {
            return false;
        }

        return true;
    };

    if (!shouldShowBanner() || product == null) {
        return null;
    }

    const notifyAdminRequestData = {
        required_feature: MattermostFeatures.UPGRADE_DOWNGRADED_WORKSPACE,
        required_plan: CloudProductToSku[product?.sku] || CloudProductToSku[CloudProducts.PROFESSIONAL],
        trial_notification: false,
    };

    const message = (
        <FormattedMessage
            id={t('cloud_delinquency.banner.end_user_notify_admin_title')}
            defaultMessage={'Your workspace has been downgraded. Notify your admin to fix billing issues'}
        />);

    const handleClick = () => {
        trackEvent(TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'click_notify_admin_upgrade_workspace_banner');

        notifyAdmin({
            requestData: notifyAdminRequestData,
            trackingArgs: {
                category: TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY,
                event: 'notify_admin_downgrade_delinquency_bar',
            },
        });
    };

    const handleClose = () => {
        dispatch(savePreferences(currentUser.id, [{
            category: Preferences.NOTIFY_ADMIN_REVOKE_DOWNGRADED_WORKSPACE,
            name: BannerPreferenceName,
            user_id: currentUser.id,
            value: 'dismissBanner',
        }]));
    };

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.CRITICAL}
            showCloseButton={true}
            onButtonClick={handleClick}
            modalButtonText={t('cloud_delinquency.banner.end_user_notify_admin_button')}
            modalButtonDefaultText={'Notify admin'}
            message={message}
            showLinkAsButton={true}
            isTallBanner={true}
            icon={<i className='icon icon-alert-outline'/>}
            handleClose={handleClose}
        />
    );
};

export default NotifyAdminDowngradeDelinquencyBar;
