// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';
import {isCompactMode} from 'selectors/preferences';

import type {GlobalState} from 'types/store';

import FilePreview from './file_preview';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const compactMode = isCompactMode(state);

    return {
        enableSVGs: config.EnableSVGs === 'true',
        compactMode,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(FilePreview);
