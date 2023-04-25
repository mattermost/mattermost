// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {getLogs} from 'mattermost-redux/actions/admin';

import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import {GenericAction} from 'mattermost-redux/types/actions';

import {GlobalState} from 'types/store';

import Logs from './logs';

function mapStateToProps(state: GlobalState) {
    return {
        logs: Selectors.getAllLogs(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getLogs,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Logs);
