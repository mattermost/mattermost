// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import {Constants} from 'utils/constants';
import {isFeatureEnabled} from 'utils/utils';

import type {GlobalState} from 'types/store';

import EditChannelHeaderModal from './edit_channel_header_modal';

function mapStateToProps(state: GlobalState) {
    return {
        markdownPreviewFeatureIsEnabled: isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.MARKDOWN_PREVIEW, state),
        shouldShowPreview: showPreviewOnEditChannelHeaderModal(state),
        ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            patchChannel,
            setShowPreview: setShowPreviewOnEditChannelHeaderModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(mapStateToProps, mapDispatchToProps)(EditChannelHeaderModal);
