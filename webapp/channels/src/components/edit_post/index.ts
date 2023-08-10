// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {runMessageWillBeUpdatedHooks} from 'actions/hooks';
import {unsetEditingPost} from 'actions/post_actions';
import {scrollPostListToBottom} from 'actions/views/channel';
import {openModal} from 'actions/views/modals';
import {editPost} from 'actions/views/posts';
import {addMessageIntoHistory} from 'mattermost-redux/actions/posts';
import {Preferences, Permissions} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {getEditingPost} from 'selectors/posts';

import {setGlobalItem} from '../../actions/storage';
import {getIsRhsOpen, getPostDraft, getRhsState} from '../../selectors/rhs';
import {GlobalState} from 'types/store';
import Constants, {RHSStates, StoragePrefixes} from 'utils/constants';

import EditPost, {Actions} from './edit_post';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const editingPost = getEditingPost(state);
    const currentUserId = getCurrentUserId(state);
    const channelId = editingPost.post.channel_id;
    const teamId = getCurrentTeamId(state);
    const draft = getPostDraft(state, StoragePrefixes.EDIT_DRAFT, editingPost.postId);

    const isAuthor = editingPost?.post?.user_id === currentUserId;
    const deletePermission = isAuthor ? Permissions.DELETE_POST : Permissions.DELETE_OTHERS_POSTS;
    const editPermission = isAuthor ? Permissions.EDIT_POST : Permissions.EDIT_OTHERS_POSTS;

    const channel = getChannel(state, channelId);
    const useChannelMentions = haveIChannelPermission(state, teamId, channelId, Permissions.USE_CHANNEL_MENTIONS);

    return {
        canEditPost: haveIChannelPermission(state, teamId, channelId, editPermission),
        canDeletePost: haveIChannelPermission(state, teamId, channelId, deletePermission),
        codeBlockOnCtrlEnter: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true),
        ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
        draft,
        config,
        editingPost,
        teamId,
        channelId,
        maxPostSize: parseInt(config.MaxPostSize || '0', 10) || Constants.DEFAULT_CHARACTER_LIMIT,
        readOnlyChannel: !isCurrentUserSystemAdmin(state) && channel.name === Constants.DEFAULT_CHANNEL,
        useChannelMentions,
        isRHSOpened: getIsRhsOpen(state),
        isEditHistoryShowing: getRhsState(state) === RHSStates.EDIT_HISTORY,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            scrollPostListToBottom,
            addMessageIntoHistory,
            editPost,
            setDraft: setGlobalItem,
            unsetEditingPost,
            openModal,
            runMessageWillBeUpdatedHooks,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditPost);
