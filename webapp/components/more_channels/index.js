// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {getChannels} from 'mattermost-redux/actions/channels';

import MoreChannels from './more_channels.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getChannels
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MoreChannels);
