// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {ModalData} from 'types/actions.js';
import type {GlobalState} from 'types/store/index.js';

import type {PreferenceType} from '@mattermost/types/preferences';

import {getChannelTimezones, getChannelMemberCountsByGroup} from 'mattermost-redux/actions/channels';
import {resetCreatePostRequest, resetHistoryIndex} from 'mattermost-redux/actions/posts';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions, Preferences, Posts} from 'mattermost-redux/constants';
import {getAllChannelStats, getChannelMemberCountsByGroup as selectChannelMemberCountsByGroup} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {makeGetMessageInHistoryItem} from 'mattermost-redux/selectors/entities/posts';
import {getBool, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import type {ActionFunc, ActionResult, DispatchFunc} from 'mattermost-redux/types/actions.js';

import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {
    clearCommentDraftUploads,
    updateCommentDraft,
    makeOnMoveHistoryIndex,
    makeOnSubmit,
    makeOnEditLatestPost,
} from 'actions/views/create_comment';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import {openModal} from 'actions/views/modals';
import {setShowPreviewOnCreateComment} from 'actions/views/textbox';
import {getCurrentLocale} from 'selectors/i18n';
import {getPostDraft, getIsRhsExpanded, getSelectedPostFocussedAt} from 'selectors/rhs';
import {connectionErrorCount} from 'selectors/views/system';
import {showPreviewOnCreateComment} from 'selectors/views/textbox';

import type {PostDraft} from 'types/store/draft';
import {AdvancedTextEditor, Constants, StoragePrefixes} from 'utils/constants';
import {canUploadFiles} from 'utils/file_utils';

import AdvancedCreateComment from './advanced_create_comment';

type OwnProps = {
    rootId: string;
    channelId: string;
    latestPostId: string;
};

function makeMapStateToProps() {
    const getMessageInHistoryItem = makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.COMMENT as 'comment');

    return (state: GlobalState, ownProps: OwnProps) => {
        const err = state.requests.posts.createPost.error || {};

        const draft = getPostDraft(state, StoragePrefixes.COMMENT_DRAFT, ownProps.rootId);
        const isRemoteDraft = state.views.drafts.remotes[`${StoragePrefixes.COMMENT_DRAFT}${ownProps.rootId}`] || false;

        const channelMembersCount = getAllChannelStats(state)[ownProps.channelId] ? getAllChannelStats(state)[ownProps.channelId].member_count : 1;
        const messageInHistory = getMessageInHistoryItem(state);

        const channel = state.entities.channels.channels[ownProps.channelId] || {};

        const config = getConfig(state);
        const license = getLicense(state);
        const currentUserId = getCurrentUserId(state);
        const enableConfirmNotificationsToChannel = config.EnableConfirmNotificationsToChannel === 'true';
        const enableEmojiPicker = config.EnableEmojiPicker === 'true';
        const enableGifPicker = config.EnableGifPicker === 'true';
        const badConnection = connectionErrorCount(state) > 1;
        const isTimezoneEnabled = config.ExperimentalTimezone === 'true';
        const canPost = haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST);
        const useChannelMentions = haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_CHANNEL_MENTIONS);
        const isLDAPEnabled = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
        const useCustomGroupMentions = isCustomGroupsEnabled(state) && haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_GROUP_MENTIONS);
        const useLDAPGroupMentions = isLDAPEnabled && haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_GROUP_MENTIONS);
        const channelMemberCountsByGroup = selectChannelMemberCountsByGroup(state, ownProps.channelId);
        const groupsWithAllowReference = useLDAPGroupMentions || useCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, channel.team_id, channel.id) : null;
        const isFormattingBarHidden = getBool(state, Constants.Preferences.ADVANCED_TEXT_EDITOR, AdvancedTextEditor.COMMENT);
        const currentTeamId = getCurrentTeamId(state);
        const postEditorActions = state.plugins.components.PostEditorAction;

        return {
            currentTeamId,
            draft,
            isRemoteDraft,
            messageInHistory,
            channelMembersCount,
            currentUserId,
            isFormattingBarHidden,
            codeBlockOnCtrlEnter: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true),
            ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            createPostErrorId: err.server_error_id,
            enableConfirmNotificationsToChannel,
            enableEmojiPicker,
            enableGifPicker,
            locale: getCurrentLocale(state),
            maxPostSize: parseInt(config.MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT,
            rhsExpanded: getIsRhsExpanded(state),
            badConnection,
            isTimezoneEnabled,
            selectedPostFocussedAt: getSelectedPostFocussedAt(state),
            canPost,
            useChannelMentions,
            shouldShowPreview: showPreviewOnCreateComment(state),
            groupsWithAllowReference,
            useLDAPGroupMentions,
            channelMemberCountsByGroup,
            useCustomGroupMentions,
            canUploadFiles: canUploadFiles(config),
            postEditorActions,
        };
    };
}

function makeOnUpdateCommentDraft(rootId: string, channelId: string) {
    return (draft?: PostDraft, save = false) => updateCommentDraft(rootId, draft ? {...draft, channelId} : draft, save);
}

function makeUpdateCommentDraftWithRootId(channelId: string) {
    return (rootId: string, draft?: PostDraft, save = false) => updateCommentDraft(rootId, draft ? {...draft, channelId} : draft, save);
}

type Actions = {
    clearCommentDraftUploads: () => void;
    onUpdateCommentDraft: (draft?: PostDraft, save?: boolean) => void;
    updateCommentDraftWithRootId: (rootID: string, draft: PostDraft, save?: boolean) => void;
    onSubmit: (draft: PostDraft, options: {ignoreSlash: boolean}) => void;
    onResetHistoryIndex: () => void;
    onMoveHistoryIndexBack: () => void;
    onMoveHistoryIndexForward: () => void;
    onEditLatestPost: () => ActionResult;
    resetCreatePostRequest: () => void;
    getChannelTimezones: (channelId: string) => Promise<ActionResult>;
    emitShortcutReactToLastPostFrom: (location: string) => void;
    setShowPreview: (showPreview: boolean) => void;
    getChannelMemberCountsByGroup: (channelID: string, includeTimezones: boolean) => void;
    openModal: <P>(modalData: ModalData<P>) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<{ data: any }>;
};

function makeMapDispatchToProps() {
    let onUpdateCommentDraft: (draft?: PostDraft, save?: boolean) => void;
    let updateCommentDraftWithRootId: (rootID: string, draft: PostDraft, save?: boolean) => void;
    let onSubmit: (
        draft: PostDraft,
        options: {ignoreSlash: boolean},
    ) => (dispatch: DispatchFunc, getState: () => GlobalState) => Promise<ActionResult | ActionResult[]> | ActionResult;
    let onMoveHistoryIndexBack: () => (
        dispatch: DispatchFunc,
        getState: () => GlobalState,
    ) => Promise<ActionResult | ActionResult[]> | ActionResult;
    let onMoveHistoryIndexForward: () => (
        dispatch: DispatchFunc,
        getState: () => GlobalState,
    ) => Promise<ActionResult | ActionResult[]> | ActionResult;
    let onEditLatestPost: () => ActionFunc;

    function onResetHistoryIndex() {
        return resetHistoryIndex(Posts.MESSAGE_TYPES.COMMENT);
    }

    let rootId: string;
    let channelId: string;
    let latestPostId: string;

    return (dispatch: Dispatch, ownProps: OwnProps) => {
        if (rootId !== ownProps.rootId) {
            onUpdateCommentDraft = makeOnUpdateCommentDraft(ownProps.rootId, ownProps.channelId);
            onMoveHistoryIndexBack = makeOnMoveHistoryIndex(ownProps.rootId, -1);
            onMoveHistoryIndexForward = makeOnMoveHistoryIndex(ownProps.rootId, 1);
        }

        if (channelId !== ownProps.channelId) {
            updateCommentDraftWithRootId = makeUpdateCommentDraftWithRootId(ownProps.channelId);
        }

        if (rootId !== ownProps.rootId) {
            onEditLatestPost = makeOnEditLatestPost(ownProps.rootId);
        }

        if (rootId !== ownProps.rootId || channelId !== ownProps.channelId || latestPostId !== ownProps.latestPostId) {
            onSubmit = makeOnSubmit(ownProps.channelId, ownProps.rootId, ownProps.latestPostId);
        }

        rootId = ownProps.rootId;
        channelId = ownProps.channelId;
        latestPostId = ownProps.latestPostId;

        return bindActionCreators<ActionCreatorsMapObject<any>, Actions>(
            {
                clearCommentDraftUploads,
                onUpdateCommentDraft,
                updateCommentDraftWithRootId,
                onSubmit,
                onResetHistoryIndex,
                onMoveHistoryIndexBack,
                onMoveHistoryIndexForward,
                onEditLatestPost,
                resetCreatePostRequest,
                getChannelTimezones,
                emitShortcutReactToLastPostFrom,
                setShowPreview: setShowPreviewOnCreateComment,
                getChannelMemberCountsByGroup,
                openModal,
                savePreferences,
                searchAssociatedGroupsForReference,
            },
            dispatch,
        );
    };
}

export default connect(makeMapStateToProps, makeMapDispatchToProps, null, {forwardRef: true})(AdvancedCreateComment);
