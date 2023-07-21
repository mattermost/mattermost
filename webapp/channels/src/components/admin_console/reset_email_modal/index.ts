// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserProfile} from '@mattermost/types/users';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {patchUser} from 'mattermost-redux/actions/users';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import ResetEmailModal from './reset_email_modal';

type Actions = {
    patchUser: (user: UserProfile) => ActionResult;
}

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            patchUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ResetEmailModal);
