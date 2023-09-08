// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {Post} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';

import {getChannelTimezones, getChannelMemberCountsByGroup} from 'mattermost-redux/actions/channels';
import {
    addMessageIntoHistory,
    moveHistoryIndexBack,
    moveHistoryIndexForward,
    removeReaction,
} from 'mattermost-redux/actions/posts';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions, Posts, Preferences as PreferencesRedux} from 'mattermost-redux/constants';
import {getCurrentChannelId, getCurrentChannel, getCurrentChannelStats, getChannelMemberCountsByGroup as selectChannelMemberCountsByGroup} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReferenceByMention} from 'mattermost-redux/selectors/entities/groups';
import {
    getCurrentUsersLatestPost,
    getLatestReplyablePostId,
    makeGetMessageInHistoryItem,
    isPostPriorityEnabled,
} from 'mattermost-redux/selectors/entities/posts';
import {get, getInt, getBool, isCustomGroupsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {haveICurrentChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getStatusForUserId, getUser, isCurrentUserGuestUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult, GetStateFunc, DispatchFunc} from 'mattermost-redux/types/actions.js';

import {executeCommand} from 'actions/command';
import {runMessageWillBePostedHooks, runSlashCommandWillBePostedHooks} from 'actions/hooks';
import {addReaction, createPost, setEditingPost, emitShortcutReactToLastPostFrom} from 'actions/post_actions';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import {scrollPostListToBottom} from 'actions/views/channel';
import {removeDraft, updateDraft} from 'actions/views/drafts';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import {openModal} from 'actions/views/modals';
import {selectPostFromRightHandSideSearchByPostId} from 'actions/views/rhs';
import {setShowPreviewOnCreatePost} from 'actions/views/textbox';
import {getEmojiMap, getShortcutReactToLastPostEmittedFrom} from 'selectors/emojis';
import {getCurrentLocale} from 'selectors/i18n';
import {makeGetChannelDraft, getIsRhsExpanded, getIsRhsOpen} from 'selectors/rhs';
import {connectionErrorCount} from 'selectors/views/system';
import {showPreviewOnCreatePost} from 'selectors/views/textbox';

import {OnboardingTourSteps, TutorialTourName, OnboardingTourStepsForGuestUsers} from 'components/tours';

import {AdvancedTextEditor, Constants, Preferences, StoragePrefixes, UserStatuses} from 'utils/constants';
import {canUploadFiles} from 'utils/file_utils';

import type {ModalData} from 'types/actions.js';
import type {PostDraft} from 'types/store/draft';
import type {GlobalState} from 'types/store/index.js';

import AdvancedCreatePost from './advanced_create_post';

function makeMapStateToProps() {
    const getMessageInHistoryItem = makeGetMessageInHistoryItem(Posts.MESSAGE_TYPES.POST as any);
    const getChannelDraft = makeGetChannelDraft();

    return (state: GlobalState) => {
        const config = getConfig(state);
        const license = getLicense(state);
        const currentChannel = getCurrentChannel(state) || {};
        const currentChannelTeammateUsername = getUser(state, currentChannel.teammate_id || '')?.username;
        const draft = getChannelDraft(state, currentChannel.id);
        const isRemoteDraft = state.views.drafts.remotes[`${StoragePrefixes.DRAFT}${currentChannel.id}`] || false;
        const latestReplyablePostId = getLatestReplyablePostId(state);
        const currentChannelMembersCount = getCurrentChannelStats(state) ? getCurrentChannelStats(state).member_count : 1;
        const enableEmojiPicker = config.EnableEmojiPicker === 'true';
        const enableGifPicker = config.EnableGifPicker === 'true';
        const enableConfirmNotificationsToChannel = config.EnableConfirmNotificationsToChannel === 'true';
        const currentUserId = getCurrentUserId(state);
        const userIsOutOfOffice = getStatusForUserId(state, currentUserId) === UserStatuses.OUT_OF_OFFICE;
        const badConnection = connectionErrorCount(state) > 1;
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
        const postEditorActions = state.plugins.components.PostEditorAction;

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
            canUploadFiles: canUploadFiles(config),
            enableEmojiPicker,
            enableGifPicker,
            enableConfirmNotificationsToChannel,
            maxPostSize: parseInt(config.MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT,
            userIsOutOfOffice,
            rhsExpanded: getIsRhsExpanded(state),
            rhsOpen: getIsRhsOpen(state),
            emojiMap: getEmojiMap(state),
            badConnection,
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
            postEditorActions,
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
    getChannelMemberCountsByGroup: (channelId: string, includeTimezones: boolean) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => ActionResult;
    searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<{ data: any }>;
}

function setDraft(key: string, value: PostDraft, draftChannelId: string, save = false) {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const channelId = draftChannelId || getCurrentChannelId(getState());
        let updatedValue = null;
        if (value) {
            updatedValue = {...value, channelId};
        }
        if (updatedValue) {
            return dispatch(updateDraft(key, updatedValue, '', save));
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
            getChannelMemberCountsByGroup,
            savePreferences,
            searchAssociatedGroupsForReference,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(AdvancedCreatePost);
