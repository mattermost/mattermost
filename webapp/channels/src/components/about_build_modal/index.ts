// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';

import {getSocketStatus} from 'selectors/views/websocket';

import type {GlobalState} from 'types/store';

import AboutBuildModal from './about_build_modal';

function mapStateToProps(state: GlobalState) {
    return {
        config: getConfig(state),
        license: getLicense(state),
        socketStatus: getSocketStatus(state),
    };
}

export default connect(mapStateToProps)(AboutBuildModal);
