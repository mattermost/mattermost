// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getChannel} from 'mattermost-redux/actions/channels';

import {postEphemeralCallResponseForPost, handleBindingClick, openAppsModal} from 'actions/apps';

import SelectBinding from './select_binding';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            handleBindingClick,
            getChannel,
            postEphemeralCallResponseForPost,
            openAppsModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(SelectBinding);
