// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {
    getSubscriptionProduct,
} from 'mattermost-redux/selectors/entities/cloud';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {
    getCurrentUser,
} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetSubscription from 'components/common/hooks/useGetSubscription';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';

import type {GlobalState} from 'types/store';
import {
    AnnouncementBarTypes,
    Preferences,
    CloudBanners,
    CloudProducts,
} from 'utils/constants';
import {t} from 'utils/i18n';

import AnnouncementBar from '../default_announcement_bar';

const CloudTrialEndAnnouncementBar: React.FC = () => {
    const limits = useGetLimits();
    const subscription = useGetSubscription();
    const getCategory = makeGetCategory();
    const dispatch = useDispatch();
    const preferences = useSelector((state: GlobalState) =>
        getCategory(state, Preferences.CLOUD_TRIAL_END_BANNER),
    );
    const currentUser = useSelector((state: GlobalState) =>
        getCurrentUser(state),
    );
    const subscriptionProduct = useSelector((state: GlobalState) => getSubscriptionProduct(state));

    const openPricingModal = useOpenPricingModal();

    const shouldShowBanner = () => {
        if (!subscription || !subscriptionProduct) {
            return false;
        }

        // Make sure limits are loaded before showing banner
        if (!limits || !limits[1]) {
            return false;
        }

        if (!preferences) {
            return false;
        }
        if (preferences.some((pref) => pref.name === CloudBanners.HIDE && pref.value === 'true')) {
            return false;
        }

        // Don't show this banner for professional or enterprise installations
        if (subscriptionProduct?.sku !== CloudProducts.STARTER) {
            return false;
        }

        const isFreeTrial = subscription.is_free_trial === 'true';
        if (isFreeTrial) {
            return false;
        }

        const trialEnd = new Date(subscription.trial_end_at);
        const now = new Date();

        // trial_end_at values will be 0 for all freemium subscriptions after June 15
        // Subscriptions created prior to that will almost always have a trial_end_at value, guaranteed.
        if (subscription.trial_end_at === 0 || trialEnd > now || trialEnd < new Date('2022-06-15')) {
            return false;
        }
        if (!isSystemAdmin(currentUser.roles)) {
            return false;
        }
        return true;
    };

    if (!shouldShowBanner()) {
        return null;
    }

    const handleClose = () => {
        dispatch(
            savePreferences(currentUser.id, [
                {
                    category: Preferences.CLOUD_TRIAL_END_BANNER,
                    user_id: currentUser.id,
                    name: CloudBanners.HIDE,
                    value: 'true',
                },
            ]),
        );
    };

    const message = {
        id: t('free.banner.downgraded'),
        defaultMessage:
            'Your workspace now has restrictions and some data has been archived',
    };

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.CRITICAL}
            showCloseButton={true}
            onButtonClick={() => openPricingModal({trackingLocation: 'cloud_trial_ended_announcement_bar'})}
            modalButtonText={t('more.details')}
            modalButtonDefaultText={'More details'}
            message={<FormattedMessage {...message}/>}
            showLinkAsButton={true}
            isTallBanner={true}
            icon={<i className='icon icon-alert-outline'/>}
            handleClose={handleClose}
        />
    );
};

export default CloudTrialEndAnnouncementBar;
