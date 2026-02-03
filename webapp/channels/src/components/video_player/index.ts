// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import VideoPlayer from './video_player';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);

    return {
        // Default maxHeight from config, can be overridden by passing maxHeight prop
        defaultMaxHeight: parseInt(config.MattermostExtendedMediaMaxVideoHeight || '350', 10),
        // Default maxWidth from config, can be overridden by passing maxWidth prop
        defaultMaxWidth: parseInt(config.MattermostExtendedMediaMaxVideoWidth || '480', 10),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(VideoPlayer);
