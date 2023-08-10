// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getSessions, revokeSession} from 'mattermost-redux/actions/users';
import {getCurrentUserId, getUserSessions} from 'mattermost-redux/selectors/entities/users';

import {getCurrentLocale} from 'selectors/i18n';

import ActivityLogModal from './activity_log_modal';

import type {Props} from './activity_log_modal';
import type {ActionFunc, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
        sessions: getUserSessions(state),
        locale: getCurrentLocale(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc| GenericAction>, Props['actions']>({
            getSessions,
            revokeSession,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ActivityLogModal);
