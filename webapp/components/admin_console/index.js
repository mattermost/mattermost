// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getConfig} from 'mattermost-redux/actions/admin';

import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import AdminConsole from './admin_console.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        config: Selectors.getConfig(state)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getConfig
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AdminConsole);
