// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {dismissNotice} from 'actions/views/notice';

import {AnnouncementBarMessages, ConfigurationBanners, Preferences} from 'utils/constants';
import {getSiteURL} from 'utils/url';

import ConfigurationBar from './configuration_bar';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const currentUserId = getCurrentUserId(state);
    return {
        siteURL: getSiteURL(),
        dismissedExpiringTrialLicense: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.TRIAL_LICENSE_EXPIRING]),
        dismissedExpiredLicense: Boolean(getPreference(state, Preferences.CONFIGURATION_BANNERS, ConfigurationBanners.LICENSE_EXPIRED) === 'true'),
        dismissedExpiringLicense: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.LICENSE_EXPIRING]),
        dismissedNumberOfActiveUsersWarnMetricStatus: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_USERS]),
        dismissedNumberOfActiveUsersWarnMetricStatusAck: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_USERS_ACK]),
        dismissedNumberOfPostsWarnMetricStatus: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_POSTS]),
        dismissedNumberOfPostsWarnMetricStatusAck: Boolean(state.views.notice.hasBeenDismissed[AnnouncementBarMessages.WARN_METRIC_STATUS_NUMBER_OF_POSTS_ACK]),
        currentUserId,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            dismissNotice,
            savePreferences,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ConfigurationBar);
