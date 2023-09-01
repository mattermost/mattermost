// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store/index.js';

import {ModalData} from 'types/actions.js';

import {ActionFunc, ActionResult} from 'mattermost-redux/types/actions.js';

import {PostDraft} from 'types/store/draft';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {makeGetMessageInHistoryItem} from 'mattermost-redux/selectors/entities/posts';
import {moveHistoryIndexBack, moveHistoryIndexForward, resetCreatePostRequest, resetHistoryIndex} from 'mattermost-redux/actions/posts';
import {Permissions, Posts} from 'mattermost-redux/constants';
import {PreferenceType} from '@mattermost/types/preferences';
import {savePreferences} from 'mattermost-redux/actions/preferences';

import {AdvancedTextEditor, Constants, StoragePrefixes} from 'utils/constants';
import {getCurrentLocale} from 'selectors/i18n';

import {
    clearCommentDraftUploads,
    handleSubmit,
    makeOnEditLatestPost,
    SubmitServerError,
    updateCommentDraft,
} from 'actions/views/create_comment';
import {emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {getPostDraft, getIsRhsExpanded, getSelectedPostFocussedAt} from 'selectors/rhs';
import {showPreviewOnCreateComment} from 'selectors/views/textbox';
import {setShowPreviewOnCreateComment} from 'actions/views/textbox';
import {openModal} from 'actions/views/modals';

import AdvancedCreateComment from './advanced_create_comment';
import {getChannelMemberCountsFromMessage} from 'actions/channel_actions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

type OwnProps = {
    rootId: string;
    channelId: string;
};

function makeMapStateToProps() {
    const getMessageInHistoryItem = makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.COMMENT as 'comment');

    return (state: GlobalState, ownProps: OwnProps) => {
        const err = state.requests.posts.createPost.error || {};

        const draft = getPostDraft(state, StoragePrefixes.COMMENT_DRAFT, ownProps.rootId);
        const isRemoteDraft = state.views.drafts.remotes[`${StoragePrefixes.COMMENT_DRAFT}${ownProps.rootId}`] || false;

        const messageInHistory = getMessageInHistoryItem(state);

        const channel = getChannel(state, ownProps.channelId) || {};
        const currentUserId = getCurrentUserId(state);
        const canPost = haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST);
        const isFormattingBarHidden = getBool(state, Constants.Preferences.ADVANCED_TEXT_EDITOR, AdvancedTextEditor.COMMENT);

        return {
            draft,
            isRemoteDraft,
            messageInHistory,
            currentUserId,
            isFormattingBarHidden,
            createPostErrorId: err.server_error_id,
            locale: getCurrentLocale(state),
            rhsExpanded: getIsRhsExpanded(state),
            selectedPostFocussedAt: getSelectedPostFocussedAt(state),
            canPost,
            shouldShowPreview: showPreviewOnCreateComment(state),
            channel,
        };
    };
}

function makeOnUpdateCommentDraft(channelId: string) {
    return (draft: PostDraft, save = false, instant = false) => updateCommentDraft({...draft, channelId}, save, instant);
}

type Actions = {
    clearCommentDraftUploads: () => void;
    onUpdateCommentDraft: (draft: PostDraft, save?: boolean) => void;
    onResetHistoryIndex: () => void;
    moveHistoryIndexBack: (index: string) => Promise<void>;
    moveHistoryIndexForward: (index: string) => Promise<void>;
    onEditLatestPost: () => ActionResult;
    resetCreatePostRequest: () => void;
    emitShortcutReactToLastPostFrom: (location: string) => void;
    setShowPreview: (showPreview: boolean) => void;
    getChannelMemberCountsFromMessage: (channelID: string, message: string) => void;
    openModal: <P>(modalData: ModalData<P>) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    handleSubmit: (draft: PostDraft, preSubmit: () => void, onSubmitted: (res: ActionResult, draft: PostDraft) => void, serverError: SubmitServerError, latestPost: string | undefined) => ActionResult;
};

function makeMapDispatchToProps() {
    let onUpdateCommentDraft: (draft: PostDraft, save?: boolean) => void;
    let onEditLatestPost: () => ActionFunc;

    function onResetHistoryIndex() {
        return resetHistoryIndex(Posts.MESSAGE_TYPES.COMMENT);
    }

    let rootId: string;
    let channelId: string;

    return (dispatch: Dispatch, ownProps: OwnProps) => {
        if (channelId !== ownProps.channelId) {
            onUpdateCommentDraft = makeOnUpdateCommentDraft(ownProps.channelId);
        }

        if (rootId !== ownProps.rootId) {
            onEditLatestPost = makeOnEditLatestPost(ownProps.rootId);
        }

        rootId = ownProps.rootId;
        channelId = ownProps.channelId;

        return bindActionCreators<ActionCreatorsMapObject<any>, Actions>(
            {
                clearCommentDraftUploads,
                onUpdateCommentDraft,
                onResetHistoryIndex,
                moveHistoryIndexBack,
                moveHistoryIndexForward,
                onEditLatestPost,
                resetCreatePostRequest,
                emitShortcutReactToLastPostFrom,
                setShowPreview: setShowPreviewOnCreateComment,
                getChannelMemberCountsFromMessage,
                openModal,
                savePreferences,
                handleSubmit,
            },
            dispatch,
        );
    };
}

export default connect(makeMapStateToProps, makeMapDispatchToProps, null, {forwardRef: true})(AdvancedCreateComment);
