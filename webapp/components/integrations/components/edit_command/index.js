// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getCustomTeamCommands, editCommand} from 'mattermost-redux/actions/integrations';
import {getCommands} from 'mattermost-redux/selectors/entities/integrations';

import EditCommand from './edit_command.jsx';

function mapStateToProps(state, ownProps) {
    const commandId = ownProps.location.query.id;

    return {
        ...ownProps,
        commandId,
        commands: getCommands(state),
        editCommandRequest: state.requests.integrations.editCommand
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getCustomTeamCommands,
            editCommand
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditCommand);
