// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getCloudSubscription} from 'mattermost-redux/actions/cloud';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {makeGetCategory} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import {Preferences, TrialPeriodDays} from 'utils/constants';
import {getRemainingDaysFromFutureTimestamp} from 'utils/utils';

import type {GlobalState} from 'types/store';

import CloudTrialAnnouncementBar from './cloud_trial_announcement_bar';

const getCloudTrialBannerPreferences = makeGetCategory('getCloudTrialBannerPreferences', Preferences.CLOUD_TRIAL_BANNER);

function mapStateToProps(state: GlobalState) {
    const subscription = state.entities.cloud.subscription;
    const isCloud = getLicense(state).Cloud === 'true';
    let isFreeTrial = false;
    let daysLeftOnTrial = 0;

    if (isCloud && subscription?.is_free_trial === 'true') {
        isFreeTrial = true;
        daysLeftOnTrial = Math.min(
            getRemainingDaysFromFutureTimestamp(subscription.trial_end_at),
            TrialPeriodDays.TRIAL_30_DAYS,
        );
    }

    return {
        isFreeTrial,
        daysLeftOnTrial,
        userIsAdmin: isCurrentUserSystemAdmin(state),
        currentUser: getCurrentUser(state),
        isCloud,
        subscription,
        preferences: getCloudTrialBannerPreferences(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators(
            {
                savePreferences,
                openModal,
                getCloudSubscription,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CloudTrialAnnouncementBar);
