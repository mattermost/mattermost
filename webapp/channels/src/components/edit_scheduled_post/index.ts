// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {ScheduledPost} from '@mattermost/types/schedule_post';

import {addMessageIntoHistory} from 'mattermost-redux/actions/posts';
import {updateScheduledPost} from 'mattermost-redux/actions/scheduled_posts';
import {Preferences, Permissions} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {runMessageWillBeUpdatedHooks} from 'actions/hooks';
import {unsetEditingPost} from 'actions/post_actions';
import {setGlobalItem} from 'actions/storage';
import {scrollPostListToBottom} from 'actions/views/channel';
import {editPost} from 'actions/views/posts';
import {getEditingPostDetailsAndPost} from 'selectors/posts';
import {getIsRhsOpen, getPostDraft, getRhsState} from 'selectors/rhs';

import Constants, {RHSStates, StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import EditPost from './edit_post';

type Props = {
    scheduledPost?: ScheduledPost;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const config = getConfig(state);
    const currentUserId = getCurrentUserId(state);

    let editingPost;
    let channelId: string;
    let draft;
    let isAuthor;

    if (props.scheduledPost) {
        editingPost = {post: null};
        channelId = props.scheduledPost.channel_id;
        draft = getPostDraft(state, StoragePrefixes.EDIT_DRAFT, props.scheduledPost.id);
        isAuthor = true;
    } else {
        editingPost = getEditingPostDetailsAndPost(state);
        channelId = editingPost.post.channel_id;
        draft = getPostDraft(state, StoragePrefixes.EDIT_DRAFT, editingPost.postId);
        isAuthor = editingPost?.post?.user_id === currentUserId;
    }

    const teamId = getCurrentTeamId(state);
    const deletePermission = isAuthor ? Permissions.DELETE_POST : Permissions.DELETE_OTHERS_POSTS;
    const editPermission = isAuthor ? Permissions.EDIT_POST : Permissions.EDIT_OTHERS_POSTS;

    const channel = getChannel(state, channelId);
    const useChannelMentions = haveIChannelPermission(state, teamId, channelId, Permissions.USE_CHANNEL_MENTIONS);

    const canEdit = haveIChannelPermission(state, teamId, channelId, editPermission);

    return {
        canEditPost: canEdit,
        canDeletePost: haveIChannelPermission(state, teamId, channelId, deletePermission),
        codeBlockOnCtrlEnter: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true),
        ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
        draft,
        config,
        editingPost,
        teamId,
        channelId,
        maxPostSize: parseInt(config.MaxPostSize || '0', 10) || Constants.DEFAULT_CHARACTER_LIMIT,
        readOnlyChannel: !isCurrentUserSystemAdmin(state) && channel?.name === Constants.DEFAULT_CHANNEL,
        useChannelMentions,
        isRHSOpened: getIsRhsOpen(state),
        isEditHistoryShowing: getRhsState(state) === RHSStates.EDIT_HISTORY,
        scheduledPost: props.scheduledPost,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            scrollPostListToBottom,
            addMessageIntoHistory,
            editPost,
            setDraft: setGlobalItem,
            unsetEditingPost,
            runMessageWillBeUpdatedHooks,
            updateScheduledPost,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditPost);
