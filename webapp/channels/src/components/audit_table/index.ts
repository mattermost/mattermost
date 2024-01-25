// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import AuditTable from './audit_table';

function mapStateToProps(state: GlobalState) {
    return {
        currentUser: getCurrentUser(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            getMissingProfilesByIds,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AuditTable);
