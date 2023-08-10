// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import {setShowPreviewOnEditChannelHeaderModal} from 'actions/views/textbox';
import {showPreviewOnEditChannelHeaderModal} from 'selectors/views/textbox';

import {Constants} from 'utils/constants';
import {isFeatureEnabled} from 'utils/utils';

import EditChannelHeaderModal from './edit_channel_header_modal';

import type {Channel} from '@mattermost/types/channels';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        markdownPreviewFeatureIsEnabled: isFeatureEnabled(Constants.PRE_RELEASE_FEATURES.MARKDOWN_PREVIEW, state),
        shouldShowPreview: showPreviewOnEditChannelHeaderModal(state),
        ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
    };
}

type Actions = {
    patchChannel: (channelId: string, patch: Partial<Channel>) => Promise<ActionResult>;
    setShowPreview: (showPreview: boolean) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            patchChannel,
            setShowPreview: setShowPreviewOnEditChannelHeaderModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditChannelHeaderModal);
