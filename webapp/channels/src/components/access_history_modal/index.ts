// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getUserAudits} from 'mattermost-redux/actions/users';
import {getCurrentUserId, getUserAudits as getCurrentUserAudits} from 'mattermost-redux/selectors/entities/users';

import AccessHistoryModal from './access_history_modal';

import type {GenericAction} from 'mattermost-redux/types/actions';
import type {Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        currentUserId: getCurrentUserId(state),
        userAudits: getCurrentUserAudits(state) || [],
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getUserAudits,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AccessHistoryModal);
