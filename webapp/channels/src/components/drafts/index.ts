// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';
import {makeGetDrafts} from 'selectors/drafts';

import {GlobalState} from 'types/store';

import Drafts from './drafts';

function makeMapStateToProps() {
    const getDrafts = makeGetDrafts();
    return (state: GlobalState) => {
        const user = getCurrentUser(state);
        const status = getStatusForUserId(state, user.id);

        return {
            displayName: displayUsername(user, getTeammateNameDisplaySetting(state)),
            drafts: getDrafts(state),
            draftRemotes: state.views.drafts.remotes,
            status,
            user,
        };
    };
}

export default connect(makeMapStateToProps)(Drafts);
