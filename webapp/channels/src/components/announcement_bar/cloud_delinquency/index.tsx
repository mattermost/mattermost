// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {trackEvent} from 'actions/telemetry_actions';

import {useDelinquencySubscription} from 'components/common/hooks/useDelinquencySubscription';
import useGetSubscription from 'components/common/hooks/useGetSubscription';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';

import type {GlobalState} from 'types/store';
import {
    AnnouncementBarTypes, TELEMETRY_CATEGORIES,
} from 'utils/constants';
import {t} from 'utils/i18n';

import AnnouncementBar from '../default_announcement_bar';

const CloudDelinquencyAnnouncementBar = () => {
    const subscription = useGetSubscription();
    const openPurchaseModal = useOpenCloudPurchaseModal({});
    const {isDelinquencySubscription} = useDelinquencySubscription();
    const currentUser = useSelector((state: GlobalState) =>
        getCurrentUser(state),
    );

    const getBannerType = () => {
        const delinquencyDate = new Date(
            (subscription?.delinquent_since || 0) * 1000,
        );

        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
        const today = new Date();
        const diffDays = Math.round(
            Math.abs((today.valueOf() - delinquencyDate.valueOf()) / oneDay),
        );
        if (diffDays > 90) {
            return AnnouncementBarTypes.CRITICAL;
        }
        return AnnouncementBarTypes.ADVISOR;
    };

    if (!isDelinquencySubscription() || !isSystemAdmin(currentUser.roles)) {
        return null;
    }

    const bannerType = getBannerType();

    let message = {
        id: t('cloud_delinquency.banner.title'),
        defaultMessage:
            'Update your billing information now to keep paid features.',
    };

    // If critical banner, wording is different
    if (bannerType === AnnouncementBarTypes.CRITICAL) {
        message = {
            id: t('cloud_delinquency.post_downgrade_banner.title'),
            defaultMessage:
                'Update your billing information now to re-activate paid features.',
        };
    }

    return (
        <AnnouncementBar
            type={bannerType}
            showCloseButton={false}
            onButtonClick={() => {
                trackEvent(TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'click_update_billing');
                openPurchaseModal({
                    trackingLocation:
                        'cloud_delinquency_announcement_bar',
                });
            }
            }
            modalButtonText={t('cloud_delinquency.banner.buttonText')}
            modalButtonDefaultText={'Update billing now'}
            message={<FormattedMessage {...message}/>}
            showLinkAsButton={true}
            isTallBanner={true}
            icon={<i className='icon icon-alert-outline'/>}
        />
    );
};

export default CloudDelinquencyAnnouncementBar;
