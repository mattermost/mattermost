// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addCommand, getOutgoingOAuthConnections as fetchOutgoingOAuthConnections} from 'mattermost-redux/actions/integrations';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';

import type {GlobalState} from 'types/store';

import AddCommand from './add_command';

function mapStateToProps(state: GlobalState) {
    return {
        outgoingOAuthConnections: getOutgoingOAuthConnections(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addCommand,
            getOutgoingOAuthConnections: fetchOutgoingOAuthConnections,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddCommand);
