// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {markChannelAsViewedOnServer, updateApproximateViewTime} from 'mattermost-redux/actions/channels';
import {autoUpdateTimezone} from 'mattermost-redux/actions/timezone';
import {getChannel, getCurrentChannelId, isManuallyUnread} from 'mattermost-redux/selectors/entities/channels';
import {getLicense, getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, shouldShowTermsOfService} from 'mattermost-redux/selectors/entities/users';
import type {ThunkActionFunc} from 'mattermost-redux/types/actions';

import {getChannelURL} from 'selectors/urls';

import {getHistory} from 'utils/browser_history';
import {checkIfMFARequired} from 'utils/route';
import {isPermalinkURL} from 'utils/url';

import type {GlobalState} from 'types/store';

import LoggedIn from './logged_in';

type Props = {
    match: {
        url: string;
    };
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const license = getLicense(state);
    const config = getConfig(state);
    const showTermsOfService = shouldShowTermsOfService(state);
    const currentChannelId = getCurrentChannelId(state);

    return {
        currentUser: getCurrentUser(state),
        currentChannelId,
        isCurrentChannelManuallyUnread: isManuallyUnread(state, currentChannelId),
        mfaRequired: checkIfMFARequired(getCurrentUser(state), license, config, ownProps.match.url),
        showTermsOfService,
    };
}

// NOTE: suggestions where to keep this welcomed
const getChannelURLAction = (channelId: string, teamId: string, url: string): ThunkActionFunc<void, GlobalState> => (dispatch, getState) => {
    const state = getState();

    if (url && isPermalinkURL(url)) {
        return getHistory().push(url);
    }

    const channel = getChannel(state, channelId);
    return getHistory().push(getChannelURL(state, channel, teamId));
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            autoUpdateTimezone,
            getChannelURLAction,
            markChannelAsViewedOnServer,
            updateApproximateViewTime,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
