// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {trackEvent} from 'actions/telemetry_actions';
import {openModal, closeModal} from 'actions/views/modals';

import useGetHighestThresholdCloudLimit from 'components/common/hooks/useGetHighestThresholdCloudLimit';
import useGetLimits from 'components/common/hooks/useGetLimits';
import useGetUsage from 'components/common/hooks/useGetUsage';
import ThreeDaysLeftTrialModal from 'components/three_days_left_trial_modal/three_days_left_trial_modal';

import {
    Preferences,
    TELEMETRY_CATEGORIES,
    ModalIdentifiers,
    CloudBanners,
} from 'utils/constants';

import type {DispatchFunc} from 'mattermost-redux/types/actions';
import type {GlobalState} from 'types/store';

const ShowThreeDaysLeftTrialModal = () => {
    const license = useSelector(getLicense);
    const isCloud = license?.Cloud === 'true';
    const isUserAdmin = useSelector((state: GlobalState) => isCurrentUserSystemAdmin(state));
    const subscription = useSelector(getCloudSubscription);
    const isFreeTrial = subscription?.is_free_trial === 'true';

    const dispatch = useDispatch<DispatchFunc>();
    const hadAdminDismissedModal = useSelector((state: GlobalState) => getPreference(state, Preferences.CLOUD_TRIAL_BANNER, CloudBanners.THREE_DAYS_LEFT_TRIAL_MODAL_DISMISSED)) === 'true';

    const trialEndDate = new Date(subscription?.trial_end_at || 0);

    const today = moment();
    const formattedEndDate = moment(Number(trialEndDate || 0));
    const diffDays = formattedEndDate.diff(today, 'days');

    // the trial will end in three days or left
    const trialEndInThreeDaysOrLess = diffDays <= 3;

    // validate the logic for the limits and pass that to the modal as a property
    const someLimitNeedsAttention = Boolean(useGetHighestThresholdCloudLimit(useGetUsage(), useGetLimits()[0]));

    const currentUserId = useSelector(getCurrentUserId);

    const handleOnClose = async () => {
        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            'dismissed_three_days_left_trial_modal',
        );

        await dispatch(savePreferences(currentUserId, [{
            category: Preferences.CLOUD_TRIAL_BANNER,
            user_id: currentUserId,
            name: CloudBanners.THREE_DAYS_LEFT_TRIAL_MODAL_DISMISSED,
            value: 'true',
        }]));
        dispatch(closeModal(ModalIdentifiers.THREE_DAYS_LEFT_TRIAL_MODAL));
    };

    useEffect(() => {
        if (subscription?.trial_end_at === undefined || subscription.trial_end_at === 0) {
            return;
        }

        if (isCloud && isFreeTrial && isUserAdmin && !hadAdminDismissedModal && trialEndInThreeDaysOrLess) {
            dispatch(openModal({
                modalId: ModalIdentifiers.THREE_DAYS_LEFT_TRIAL_MODAL,
                dialogType: ThreeDaysLeftTrialModal,
                dialogProps: {
                    limitsOverpassed: someLimitNeedsAttention,
                    onExited: handleOnClose,
                },
            }));
            trackEvent(
                TELEMETRY_CATEGORIES.CLOUD_THREE_DAYS_LEFT_MODAL,
                'trigger_cloud_three_days_left_modal',
            );
        }
    }, [subscription?.trial_end_at]);

    return null;
};
export default ShowThreeDaysLeftTrialModal;
