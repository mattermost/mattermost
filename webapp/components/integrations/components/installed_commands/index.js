// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {regenCommandToken, deleteCommand} from 'mattermost-redux/actions/integrations';

import InstalledCommands from './installed_commands.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            regenCommandToken,
            deleteCommand
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledCommands);