// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {withRouter} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {onChannelByIdentifierEnter} from './actions';
import ChannelIdentifierRouter from './channel_identifier_router';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            onChannelByIdentifierEnter,
        }, dispatch),
    };
}

export default withRouter(connect(null, mapDispatchToProps)(ChannelIdentifierRouter));
