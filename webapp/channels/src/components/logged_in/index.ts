// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {updateApproximateViewTime} from 'mattermost-redux/actions/channels';
import {getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {autoUpdateTimezone} from 'mattermost-redux/actions/timezone';
import {getChannel, getCurrentChannelId, isManuallyUnread} from 'mattermost-redux/selectors/entities/channels';
import {getLicense, getConfig, getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, shouldShowTermsOfService} from 'mattermost-redux/selectors/entities/users';

import {getChannelURL} from 'selectors/urls';

import {getHistory} from 'utils/browser_history';
import {isEnterpriseLicense} from 'utils/license_utils';
import {checkIfMFARequired} from 'utils/route';
import {isPermalinkURL} from 'utils/url';

import type {ThunkActionFunc, GlobalState} from 'types/store';

import LoggedIn from './logged_in';

// Helper function to get Mattermost Extended config values
function getMattermostExtendedConfigValue(config: ReturnType<typeof getConfig>, key: string, defaultValue: string = ''): string {
    return (config as Record<string, string | undefined>)[key] ?? defaultValue;
}

type Props = {
    match: {
        url: string;
    };
};

export function mapStateToProps(state: GlobalState, ownProps: Props) {
    const license = getLicense(state);
    const config = getConfig(state);
    const showTermsOfService = shouldShowTermsOfService(state);
    const currentChannelId = getCurrentChannelId(state);

    // AccurateStatuses feature flag and settings
    const accurateStatusesEnabled = getFeatureFlagValue(state, 'AccurateStatuses') === 'true';
    const heartbeatIntervalSeconds = parseInt(getMattermostExtendedConfigValue(config, 'MattermostExtendedStatusesHeartbeatIntervalSeconds', '30'), 10);

    return {
        currentUser: getCurrentUser(state),
        currentChannelId,
        isCurrentChannelManuallyUnread: isManuallyUnread(state, currentChannelId),
        mfaRequired: checkIfMFARequired(getCurrentUser(state), license, config, ownProps.match.url),
        showTermsOfService,
        customProfileAttributesEnabled: isEnterpriseLicense(license) && getFeatureFlagValue(state, 'CustomProfileAttributes') === 'true',
        accurateStatusesEnabled,
        heartbeatIntervalSeconds,
    };
}

// NOTE: suggestions where to keep this welcomed
const getChannelURLAction = (channelId: string, teamId: string, url: string): ThunkActionFunc<void> => (dispatch, getState) => {
    const state = getState();

    if (url && isPermalinkURL(url)) {
        getHistory().push(url);
        return;
    }

    const channel = getChannel(state, channelId);
    if (channel) {
        getHistory().push(getChannelURL(state, channel, teamId));
    }
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            autoUpdateTimezone,
            getChannelURLAction,
            updateApproximateViewTime,
            getCustomProfileAttributeFields,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
