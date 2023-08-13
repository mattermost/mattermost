// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store/index.js';

import {ActionResult, GetStateFunc, DispatchFunc} from 'mattermost-redux/types/actions.js';

import {PostDraft} from 'types/store/draft';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getCurrentChannelId, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {get, getInt, getBool} from 'mattermost-redux/selectors/entities/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {
    getCurrentUsersLatestPost,
    getLatestReplyablePostId,
    makeGetMessageInHistoryItem,
    isPostPriorityEnabled,
} from 'mattermost-redux/selectors/entities/posts';
import {
    moveHistoryIndexBack,
    moveHistoryIndexForward,
} from 'mattermost-redux/actions/posts';
import {Permissions, Posts} from 'mattermost-redux/constants';

import {setEditingPost, emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {scrollPostListToBottom} from 'actions/views/channel';
import {selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';
import {setShowPreviewOnCreatePost} from 'actions/views/textbox';
import {getIsRhsExpanded, getIsRhsOpen, getPostDraft} from 'selectors/rhs';
import {showPreviewOnCreatePost} from 'selectors/views/textbox';
import {getCurrentLocale} from 'selectors/i18n';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import {removeDraft, updateDraft} from 'actions/views/drafts';
import {AdvancedTextEditor, Preferences, StoragePrefixes} from 'utils/constants';
import {OnboardingTourSteps, TutorialTourName, OnboardingTourStepsForGuestUsers} from 'components/tours';

import {PreferenceType} from '@mattermost/types/preferences';

import AdvancedCreatePost from './advanced_create_post';
import {getChannelMemberCountsFromMessage} from 'actions/channel_actions';
import {handleSubmit, SubmitServerError} from 'actions/views/create_comment';

function makeMapStateToProps() {
    const getMessageInHistoryItem = makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.POST as any);

    return (state: GlobalState) => {
        const config = getConfig(state);
        const currentChannel = getCurrentChannel(state) || {};
        const draft = getPostDraft(state, StoragePrefixes.DRAFT, currentChannel.id);
        const isRemoteDraft = state.views.drafts.remotes[`${StoragePrefixes.DRAFT}${currentChannel.id}`] || false;
        const latestReplyablePostId = getLatestReplyablePostId(state);
        const currentUserId = getCurrentUserId(state);
        const canPost = haveICurrentChannelPermission(state, Permissions.CREATE_POST);
        const enableTutorial = config.EnableTutorial === 'true';
        const tutorialStep = getInt(state, TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);

        // guest validation to see which point the messaging tour tip starts
        const isGuestUser = isCurrentUserGuestUser(state);
        const tourStep = isGuestUser ? OnboardingTourStepsForGuestUsers.SEND_MESSAGE : OnboardingTourSteps.SEND_MESSAGE;
        const showSendTutorialTip = enableTutorial && tutorialStep === tourStep;
        const isFormattingBarHidden = getBool(state, Preferences.ADVANCED_TEXT_EDITOR, AdvancedTextEditor.POST);

        return {
            currentChannel,
            currentUserId,
            isFormattingBarHidden,
            fullWidthTextBox: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
            showSendTutorialTip,
            messageInHistoryItem: getMessageInHistoryItem(state),
            draft,
            isRemoteDraft,
            latestReplyablePostId,
            locale: getCurrentLocale(state),
            currentUsersLatestPost: getCurrentUsersLatestPost(state, ''),
            rhsExpanded: getIsRhsExpanded(state),
            rhsOpen: getIsRhsOpen(state),
            canPost,
            shouldShowPreview: showPreviewOnCreatePost(state),
            isPostPriorityEnabled: isPostPriorityEnabled(state),
        };
    };
}

type Actions = {
    setShowPreview: (showPreview: boolean) => void;
    moveHistoryIndexBack: (index: string) => Promise<void>;
    moveHistoryIndexForward: (index: string) => Promise<void>;
    clearDraftUploads: () => void;
    setDraft: (name: string, value: PostDraft | null) => void;
    setEditingPost: (postId?: string, refocusId?: string, title?: string, isRHS?: boolean) => void;
    selectPostFromRightHandSideSearchByPostId: (postId: string) => void;
    scrollPostListToBottom: () => void;
    emitShortcutReactToLastPostFrom: (emittedFrom: string) => void;
    getChannelMemberCountsFromMessage: (channelId: string, message: string) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    handleSubmit: (draft: PostDraft, preSubmit: () => void, onSubmitted: (res: ActionResult, draft: PostDraft) => void, serverError: SubmitServerError, latestPost: string | undefined) => ActionResult;
}

function setDraft(key: string, value: PostDraft | null, draftChannelId: string, save = false, instant = false) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const channelId = draftChannelId || getCurrentChannelId(getState());
        if (value) {
            return dispatch(updateDraft(key, {...value, channelId}, save, instant));
        }
        return dispatch(removeDraft(key, channelId));
    };
}

function clearDraftUploads() {
    return actionOnGlobalItemsWithPrefix(StoragePrefixes.DRAFT, (_key: string, draft: PostDraft) => {
        if (!draft || !draft.uploadsInProgress || draft.uploadsInProgress.length === 0) {
            return draft;
        }

        return {...draft, uploadsInProgress: []};
    });
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<any>, Actions>({
            setShowPreview: setShowPreviewOnCreatePost,
            moveHistoryIndexBack,
            moveHistoryIndexForward,
            clearDraftUploads,
            setDraft,
            setEditingPost,
            selectPostFromRightHandSideSearchByPostId,
            scrollPostListToBottom,
            emitShortcutReactToLastPostFrom,
            getChannelMemberCountsFromMessage,
            savePreferences,
            handleSubmit,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedCreatePost);
