// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getLogs} from 'mattermost-redux/actions/admin';

import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import Logs from './logs.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        logs: Selectors.getLogs(state)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getLogs
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Logs);
