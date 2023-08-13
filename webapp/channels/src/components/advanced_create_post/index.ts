// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store/index.js';

import {Post} from '@mattermost/types/posts';

import {FileInfo} from '@mattermost/types/files';

import {ActionResult, GetStateFunc, DispatchFunc} from 'mattermost-redux/types/actions.js';

import {CommandArgs} from '@mattermost/types/integrations';

import {ModalData} from 'types/actions.js';

import {PostDraft} from 'types/store/draft';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentChannelId, getCurrentChannel, getCurrentChannelStats, getChannelMemberCountsByGroup as selectChannelMemberCountsByGroup} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, getStatusForUserId, getUser, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getChannelTimezones} from 'mattermost-redux/actions/channels';
import {get, getInt, getBool, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {
    getCurrentUsersLatestPost,
    getLatestReplyablePostId,
    makeGetMessageInHistoryItem,
    isPostPriorityEnabled,
} from 'mattermost-redux/selectors/entities/posts';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {
    addMessageIntoHistory,
    moveHistoryIndexBack,
    moveHistoryIndexForward,
    removeReaction,
} from 'mattermost-redux/actions/posts';
import {Permissions, Posts, Preferences as PreferencesRedux} from 'mattermost-redux/constants';

import {addReaction, createPost, setEditingPost, emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {scrollPostListToBottom} from 'actions/views/channel';
import {selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';
import {setShowPreviewOnCreatePost} from 'actions/views/textbox';
import {executeCommand} from 'actions/command';
import {runMessageWillBePostedHooks, runSlashCommandWillBePostedHooks} from 'actions/hooks';
import {getIsRhsExpanded, getIsRhsOpen, getPostDraft} from 'selectors/rhs';
import {showPreviewOnCreatePost} from 'selectors/views/textbox';
import {getCurrentLocale} from 'selectors/i18n';
import {getEmojiMap, getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import {removeDraft, updateDraft} from 'actions/views/drafts';
import {openModal} from 'actions/views/modals';
import {AdvancedTextEditor, Preferences, StoragePrefixes, UserStatuses} from 'utils/constants';
import {OnboardingTourSteps, TutorialTourName, OnboardingTourStepsForGuestUsers} from 'components/tours';

import {PreferenceType} from '@mattermost/types/preferences';

import AdvancedCreatePost from './advanced_create_post';
import {getChannelMemberCountsFromMessage} from 'actions/channel_actions';
import {onSubmit} from 'actions/views/create_comment';

function makeMapStateToProps() {
    const getMessageInHistoryItem = makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.POST as any);

    return (state: GlobalState) => {
        const config = getConfig(state);
        const license = getLicense(state);
        const currentChannel = getCurrentChannel(state) || {};
        const currentChannelTeammateUsername = getUser(state, currentChannel.teammate_id || '')?.username;
        const draft = getPostDraft(state, StoragePrefixes.DRAFT, currentChannel.id);
        const isRemoteDraft = state.views.drafts.remotes[`${StoragePrefixes.DRAFT}${currentChannel.id}`] || false;
        const latestReplyablePostId = getLatestReplyablePostId(state);
        const currentChannelMembersCount = getCurrentChannelStats(state) ? getCurrentChannelStats(state).member_count : 1;
        const enableConfirmNotificationsToChannel = config.EnableConfirmNotificationsToChannel === 'true';
        const currentUserId = getCurrentUserId(state);
        const userIsOutOfOffice = getStatusForUserId(state, currentUserId) === UserStatuses.OUT_OF_OFFICE;
        const isTimezoneEnabled = config.ExperimentalTimezone === 'true';
        const shortcutReactToLastPostEmittedFrom = getShortcutReactToLastPostEmittedFrom(state);
        const canPost = haveICurrentChannelPermission(state, Permissions.CREATE_POST);
        const useChannelMentions = haveICurrentChannelPermission(state, Permissions.USE_CHANNEL_MENTIONS);
        const isLDAPEnabled = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true';
        const useCustomGroupMentions = isCustomGroupsEnabled(state) && haveICurrentChannelPermission(state, Permissions.USE_GROUP_MENTIONS);
        const useLDAPGroupMentions = isLDAPEnabled && haveICurrentChannelPermission(state, Permissions.USE_GROUP_MENTIONS);
        const channelMemberCountsByGroup = selectChannelMemberCountsByGroup(state, currentChannel.id);
        const currentTeamId = getCurrentTeamId(state);
        const groupsWithAllowReference = useLDAPGroupMentions || useCustomGroupMentions ? getAssociatedGroupsForReferenceByMention(state, currentTeamId, currentChannel.id) : null;
        const enableTutorial = config.EnableTutorial === 'true';
        const tutorialStep = getInt(state, TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);

        // guest validation to see which point the messaging tour tip starts
        const isGuestUser = isCurrentUserGuestUser(state);
        const tourStep = isGuestUser ? OnboardingTourStepsForGuestUsers.SEND_MESSAGE : OnboardingTourSteps.SEND_MESSAGE;
        const showSendTutorialTip = enableTutorial && tutorialStep === tourStep;
        const isFormattingBarHidden = getBool(state, Preferences.ADVANCED_TEXT_EDITOR, AdvancedTextEditor.POST);

        return {
            currentTeamId,
            currentChannel,
            currentChannelTeammateUsername,
            currentChannelMembersCount,
            currentUserId,
            isFormattingBarHidden,
            codeBlockOnCtrlEnter: getBool(state, PreferencesRedux.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true),
            ctrlSend: getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'),
            fullWidthTextBox: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN,
            showSendTutorialTip,
            messageInHistoryItem: getMessageInHistoryItem(state),
            draft,
            isRemoteDraft,
            latestReplyablePostId,
            locale: getCurrentLocale(state),
            currentUsersLatestPost: getCurrentUsersLatestPost(state, ''),
            enableConfirmNotificationsToChannel,
            userIsOutOfOffice,
            rhsExpanded: getIsRhsExpanded(state),
            rhsOpen: getIsRhsOpen(state),
            emojiMap: getEmojiMap(state),
            isTimezoneEnabled,
            shortcutReactToLastPostEmittedFrom,
            canPost,
            useChannelMentions,
            shouldShowPreview: showPreviewOnCreatePost(state),
            groupsWithAllowReference,
            useLDAPGroupMentions,
            channelMemberCountsByGroup,
            isLDAPEnabled,
            useCustomGroupMentions,
            isPostPriorityEnabled: isPostPriorityEnabled(state),
        };
    };
}

function onSubmitPost(post: Post, fileInfos: FileInfo[]) {
    return (dispatch: Dispatch) => {
        dispatch(createPost(post, fileInfos) as any);
    };
}

type Actions = {
    setShowPreview: (showPreview: boolean) => void;
    addMessageIntoHistory: (message: string) => void;
    moveHistoryIndexBack: (index: string) => Promise<void>;
    moveHistoryIndexForward: (index: string) => Promise<void>;
    addReaction: (postId: string, emojiName: string) => void;
    onSubmitPost: (post: Post, fileInfos: FileInfo[]) => void;
    removeReaction: (postId: string, emojiName: string) => void;
    clearDraftUploads: () => void;
    runMessageWillBePostedHooks: (originalPost: Post) => ActionResult;
    runSlashCommandWillBePostedHooks: (originalMessage: string, originalArgs: CommandArgs) => ActionResult;
    setDraft: (name: string, value: PostDraft | null) => void;
    setEditingPost: (postId?: string, refocusId?: string, title?: string, isRHS?: boolean) => void;
    selectPostFromRightHandSideSearchByPostId: (postId: string) => void;
    openModal: <P>(modalData: ModalData<P>) => void;
    closeModal: (modalId: string) => void;
    executeCommand: (message: string, args: CommandArgs) => ActionResult;
    getChannelTimezones: (channelId: string) => ActionResult;
    scrollPostListToBottom: () => void;
    emitShortcutReactToLastPostFrom: (emittedFrom: string) => void;
    getChannelMemberCountsFromMessage: (channelId: string, message: string) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    onSubmit: (draft: PostDraft, options: {ignoreSlash?: boolean}, latestPostId?: string) => ActionResult;
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
            addMessageIntoHistory,
            onSubmitPost,
            moveHistoryIndexBack,
            moveHistoryIndexForward,
            addReaction,
            removeReaction,
            setDraft,
            clearDraftUploads,
            selectPostFromRightHandSideSearchByPostId,
            setEditingPost,
            emitShortcutReactToLastPostFrom,
            openModal,
            executeCommand,
            getChannelTimezones,
            runMessageWillBePostedHooks,
            runSlashCommandWillBePostedHooks,
            scrollPostListToBottom,
            setShowPreview: setShowPreviewOnCreatePost,
            getChannelMemberCountsFromMessage,
            savePreferences,
            onSubmit,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedCreatePost);
