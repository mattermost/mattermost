// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {trackEvent} from 'actions/telemetry_actions';

import {useDelinquencySubscription} from 'components/common/hooks/useDelinquencySubscription';
import useGetSubscription from 'components/common/hooks/useGetSubscription';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';

import {
    AnnouncementBarTypes, TELEMETRY_CATEGORIES,
} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

const CloudDelinquencyAnnouncementBar = () => {
    const subscription = useGetSubscription();
    const openPurchaseModal = useOpenCloudPurchaseModal({});
    const {isDelinquencySubscription} = useDelinquencySubscription();
    const {formatMessage} = useIntl();
    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    if (!isDelinquencySubscription() || !subscription?.cancel_at) {
        return null;
    }

    let props = {
        message: (<>{formatMessage({id: 'cloud_annual_renewal_delinquency.banner.message', defaultMessage: 'Your annual subscription has expired. Please renew now to keep this workspace'})}</>),
        modalButtonText: formatMessage({id: 'cloud_delinquency.banner.buttonText', defaultMessage: 'Update billing now'}),
        modalButtonDefaultText: 'Update billing now',
        showLinkAsButton: true,
        isTallBanner: true,
        icon: <i className='icon icon-alert-outline'/>,
        showCTA: true,
        onButtonClick: () => {
            trackEvent(TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'click_update_billing');
            openPurchaseModal({
                trackingLocation:
                    'cloud_delinquency_announcement_bar',
            });
        },
        type: AnnouncementBarTypes.CRITICAL,
        showCloseButton: false,
    };

    if (!isAdmin) {
        props = {
            ...props,
            message: (<>{formatMessage({id: 'cloud_annual_renewal_delinquency.banner.end_user.message', defaultMessage: 'Your annual subscription has expired. Please contact your System Admin to keep this workspace'})}</>),
            showCTA: false,
        };
    }

    return (
        <AnnouncementBar
            {...props}
        />
    );
};

export default CloudDelinquencyAnnouncementBar;
