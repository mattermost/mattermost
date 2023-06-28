// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store';

import {Channel} from '@mattermost/types/channels';

import {DispatchFunc, GenericAction} from 'mattermost-redux/types/actions';

import {autoUpdateTimezone} from 'mattermost-redux/actions/timezone';
import {viewChannel} from 'mattermost-redux/actions/channels';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, shouldShowTermsOfService} from 'mattermost-redux/selectors/entities/users';

import {getChannelURL} from 'selectors/urls';

import {getHistory} from 'utils/browser_history';
import {isPermalinkURL} from 'utils/url';

import LoggedIn from './logged_in';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const showTermsOfService = shouldShowTermsOfService(state);

    return {
        currentUser: getCurrentUser(state),
        currentChannelId: getCurrentChannelId(state),
        enableTimezone: config.ExperimentalTimezone === 'true',
        showTermsOfService,
    };
}

// NOTE: suggestions where to keep this welcomed
const getChannelURLAction = (channel: Channel, teamId: string, url: string) => (dispatch: DispatchFunc, getState: () => GlobalState) => {
    const state = getState();

    if (url && isPermalinkURL(url)) {
        return getHistory().push(url);
    }

    return getHistory().push(getChannelURL(state, channel, teamId));
};

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            autoUpdateTimezone,
            getChannelURLAction,
            viewChannel,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(LoggedIn);
