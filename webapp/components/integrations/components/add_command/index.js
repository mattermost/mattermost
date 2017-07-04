// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {addCommand} from 'mattermost-redux/actions/integrations';

import AddCommand from './add_command.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        addCommandRequest: state.requests.integrations.addCommand
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            addCommand
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddCommand);
