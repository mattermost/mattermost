// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getChannel} from 'mattermost-redux/actions/channels';

import {postEphemeralCallResponseForPost, handleBindingClick, openAppsModal} from 'actions/apps';

import ButtonBinding from './button_binding';

import type {ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {PostEphemeralCallResponseForPost, HandleBindingClick, OpenAppsModal} from 'types/apps';

type Actions = {
    handleBindingClick: HandleBindingClick;
    getChannel: (channelId: string) => Promise<ActionResult>;
    postEphemeralCallResponseForPost: PostEphemeralCallResponseForPost;
    openAppsModal: OpenAppsModal;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            handleBindingClick,
            getChannel,
            postEphemeralCallResponseForPost,
            openAppsModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(ButtonBinding);
