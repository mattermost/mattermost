// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions} from 'mattermost-redux/constants';
import {getChannel, makeGetChannel, getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getFeatureFlagValue, isPostAttributesEnabled} from 'mattermost-redux/selectors/entities/general';
import {get, getBool, getInt, getWysiwygEditorPreference} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId, isCurrentUserGuestUser, getStatusForUserId, getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import * as GlobalActions from 'actions/global_actions';
import type {CreatePostOptions} from 'actions/post_actions';
import type {SubmitPostReturnType} from 'actions/views/create_comment';
import {removeDraft, updateDraft} from 'actions/views/drafts';
import {openModal} from 'actions/views/modals';
import {makeGetDraft} from 'selectors/drafts';
import {getSelectedPostFocussedAt} from 'selectors/rhs';
import {connectionErrorCount} from 'selectors/views/system';
import LocalStorageStore from 'stores/local_storage_store';

import PostAttributesButton from 'components/advanced_text_editor/post_attributes_button';
import PostBoxIndicator from 'components/advanced_text_editor/post_box_indicator/post_box_indicator';
import {applyWysiwygFormatting} from 'components/advanced_text_editor/wysiwyg_editor/apply_wysiwyg_formatting';
import WysiwygEditor from 'components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor';
import type {WysiwygEditorHandle} from 'components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor';
import AutoHeightSwitcher from 'components/common/auto_height_switcher';
import {useChannelManagementAccess} from 'components/common/hooks/useChannelManagementAccess';
import {useChannelWriteAccess} from 'components/common/hooks/useChannelWriteAccess';
import useDidUpdate from 'components/common/hooks/useDidUpdate';
import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import DeletePostModal from 'components/delete_post_modal';
import {
    DropOverlayIdCreateComment,
    DropOverlayIdCreatePost,
    DropOverlayIdEditPost, FileUploadOverlay,
} from 'components/file_upload_overlay/file_upload_overlay';
import PostAttributesComposer from 'components/post_attributes/post_attributes_composer';
import {useComposerAttributes} from 'components/post_attributes/use_composer_attributes';
import {useStagedPostAttributes} from 'components/post_attributes/use_staged_post_attributes';
import RhsSuggestionList from 'components/suggestion/rhs_suggestion_list';
import SuggestionList from 'components/suggestion/suggestion_list';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import {OnboardingTourSteps, OnboardingTourStepsForGuestUsers, TutorialTourName} from 'components/tours/constant';
import {SendMessageTour} from 'components/tours/onboarding_tour';

import {useLatest} from 'hooks/useLatest';
import Constants, {
    Locations,
    StoragePrefixes,
    Preferences,
    AdvancedTextEditor as AdvancedTextEditorConst,
    UserStatuses,
    ModalIdentifiers,
    AdvancedTextEditorTextboxIds,
} from 'utils/constants';
import {replaceTextboxValue} from 'utils/exec_commands';
import {canUploadFiles as canUploadFilesAccordingToConfig} from 'utils/file_utils';
import type {MarkdownMode} from 'utils/markdown/apply_markdown';
import {applyMarkdown as applyMarkdownUtil} from 'utils/markdown/apply_markdown';
import {isErrorInvalidSlashCommand} from 'utils/post_utils';
import {getDraftRepeatDisabledReason} from 'utils/scheduled_post_repeat';
import {allAtMentions} from 'utils/text_formatting';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import {isPostDraftEmpty} from 'types/store/draft';

import AIActionsMenu from './ai_actions_menu';
import DoNotDisturbWarning from './do_not_disturb_warning';
import EditPostFooter from './edit_post_footer';
import Footer from './footer';
import FormattingBar from './formatting_bar';
import {FormattingBarSpacer, Separator} from './formatting_bar/formatting_bar';
import type {FormattingBarHandle} from './formatting_bar/formatting_bar';
import MessageWithMentionsFooter from './message_with_mentions_footer';
import OutOfOfficeWarning from './out_of_office_warning';
import SendButton from './send_button';
import ShowFormat from './show_formatting';
import TexteditorActions from './texteditor_actions';
import ToggleFormattingBar from './toggle_formatting_bar';
import UnifiedLabelsWrapper from './unified_labels_wrapper';
import useBurnOnRead from './use_burn_on_read';
import {useComposerPlaceholder} from './use_composer_placeholder';
import useEditorEmojiPicker from './use_editor_emoji_picker';
import useKeyHandler from './use_key_handler';
import usePendingQuote from './use_pending_quote';
import usePluginItems from './use_plugin_items';
import usePriority from './use_priority';
import useRewrite from './use_rewrite';
import useSubmit from './use_submit';
import useTextboxFocus from './use_textbox_focus';
import useUploadFiles from './use_upload_files';

import './advanced_text_editor.scss';

export type Props = {

    /**
     * location of the advanced text editor in the UI (center channel / RHS)
     */
    location: string;
    channelId: string;
    rootId: string;
    postId?: string;
    isThreadView?: boolean;
    placeholder?: string;
    isInEditMode?: boolean;

    /**
     * Key to store the draft in the storage
     * If not provided, draft key will be computed based on the post
     */
    storageKey?: string;

    /**
     * Used by plugins to act after the post is made
     */
    afterSubmit?: (response: SubmitPostReturnType) => void;
};

const AdvancedTextEditor = ({
    location,
    channelId,
    rootId: rootIdProp,
    postId,
    isThreadView = false,
    placeholder,
    isInEditMode = false,
    afterSubmit,
    storageKey,
}: Props) => {
    // rootId is typed as required, but plugins reach this component through the untyped
    // window.Components bridge and may omit it. Every draft carries '' rather than undefined
    // for a non-thread composer, so an undefined prop desyncs the id comparisons below.
    const rootId = rootIdProp ?? '';

    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const getChannelSelector = useMemo(() => makeGetChannel(), []);
    const getDraftSelector = useMemo(() => makeGetDraft(), []);
    const getDisplayName = useMemo(() => makeGetDisplayName(), []);

    let textboxId: string;
    let testIdScope: string;
    if (isInEditMode) {
        textboxId = AdvancedTextEditorTextboxIds.InEditMode;
        testIdScope = 'post_edit.editor';
    } else if (location === Locations.CENTER) {
        textboxId = AdvancedTextEditorTextboxIds.InCenter;
        testIdScope = 'center.post_create';
    } else if (location === Locations.RHS_COMMENT) {
        textboxId = AdvancedTextEditorTextboxIds.InRHSComment;
        testIdScope = 'rhs.post_create';
    } else if (location === Locations.MODAL) {
        textboxId = AdvancedTextEditorTextboxIds.InModal;
        testIdScope = 'modal.post_create';
    } else {
        textboxId = AdvancedTextEditorTextboxIds.Default;
        testIdScope = 'plugin.post_create';
    }

    const isRHS = isThreadView ? false : Boolean(rootId) || location === Locations.RHS_COMMENT;

    const getFormattingBarPreferenceName = () => {
        let name: string;
        if (isRHS) {
            name = isInEditMode ? AdvancedTextEditorConst.EDIT : AdvancedTextEditorConst.COMMENT;
        } else {
            name = AdvancedTextEditorConst.POST;
        }

        return name;
    };

    const currentUserId = useSelector(getCurrentUserId);
    const channel = useSelector((state: GlobalState) => getChannelSelector(state, channelId));
    const channelDisplayName = channel?.display_name || '';
    const channelType = channel?.type || '';
    const isChannelShared = channel?.shared;
    const draftFromStore = useSelector((state: GlobalState) => getDraftSelector(state, channelId, rootId, storageKey));
    const badConnection = useSelector((state: GlobalState) => connectionErrorCount(state) > 1);
    const maxPostSize = useSelector((state: GlobalState) => parseInt(getConfig(state).MaxPostSize || '', 10) || Constants.DEFAULT_CHARACTER_LIMIT);
    const canUploadFiles = useSelector((state: GlobalState) => canUploadFilesAccordingToConfig(getConfig(state)));
    const fullWidthTextBox = useSelector((state: GlobalState) => get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT) === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN);
    const isFormattingBarHidden = useSelector((state: GlobalState) => {
        const preferenceName = getFormattingBarPreferenceName();
        return getBool(state, Preferences.ADVANCED_TEXT_EDITOR, preferenceName);
    });
    const teammateId = useSelector((state: GlobalState) => getDirectChannel(state, channelId)?.teammate_id || '');
    const teammateDisplayName = useSelector((state: GlobalState) => (teammateId ? getDisplayName(state, teammateId) : ''));
    const showDndWarning = useSelector((state: GlobalState) => (teammateId ? getStatusForUserId(state, teammateId) === UserStatuses.DND : false));
    const showOooWarning = useSelector((state: GlobalState) => {
        if (!teammateId) {
            return false;
        }
        if (getConfig(state).ExperimentalEnableAutomaticReplies !== 'true') {
            return false;
        }
        if (teammateId === getCurrentUserId(state)) {
            return false;
        }
        const teammate = getUser(state, teammateId);
        if (teammate?.is_bot) {
            return false;
        }
        return getStatusForUserId(state, teammateId) === UserStatuses.OUT_OF_OFFICE;
    });
    const selectedPostFocussedAt = useSelector((state: GlobalState) => getSelectedPostFocussedAt(state));
    const aiActionMenuItems = useSelector((state: GlobalState) => state.plugins.components.AIActionMenuItem);
    const {available: aiRewriteEnabled} = useGetAgentsBridgeEnabled();

    const canPost = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST) : false;
    });

    const writeAllowedByPolicy = useChannelWriteAccess(channelId);

    // Fetched here, alongside the write decision, only so it is cached: the management
    // controls around the channel (members, bookmarks, header menu, Channel Settings)
    // read it through haveIChannelPermission rather than fetching their own.
    useChannelManagementAccess(channelId);
    const useChannelMentions = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.USE_CHANNEL_MENTIONS) : false;
    });
    const showSendTutorialTip = useSelector((state: GlobalState) => {
        // We don't show the tutorial tip neither on RHS nor Thread view
        if (rootId) {
            return false;
        }
        const config = getConfig(state);
        const enableTutorial = config.EnableTutorial === 'true';

        const tutorialStep = getInt(state, TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);

        // guest validation to see which point the messaging tour tip starts
        const isGuestUser = isCurrentUserGuestUser(state);
        const tourStep = isGuestUser ? OnboardingTourStepsForGuestUsers.SEND_MESSAGE : OnboardingTourSteps.SEND_MESSAGE;

        return enableTutorial && (tutorialStep === tourStep);
    });

    const editorActionsRef = useRef<HTMLDivElement>(null);
    const editorBodyRef = useRef<HTMLDivElement>(null);
    const textboxRef = useRef<TextboxClass>(null);
    const wysiwygRef = useRef<WysiwygEditorHandle>(null);
    const formattingBarRef = useRef<FormattingBarHandle>(null);
    const loggedInAriaLabelTimeout = useRef<NodeJS.Timeout>(undefined);
    const pendingDraftSave = useRef<{key: string; save: () => void; timeout: NodeJS.Timeout}>(undefined);
    const draftRef = useRef(draftFromStore);
    const locationRef = useLatest({channelId, rootId});
    const storedDrafts = useRef<Record<string, PostDraft | undefined>>({});
    const lastBlurAt = useRef(0);
    const messageStatusRef = useRef<HTMLDivElement | null>(null);

    const [draft, setDraft] = useState(draftFromStore);
    const [serverError, setServerError] = useState<(ServerError & {submittedMessage?: string}) | null>(null);
    const [postError, setPostError] = useState<React.ReactNode>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isMessageLong, setIsMessageLong] = useState(false);
    const [renderScrollbar, setRenderScrollbar] = useState(false);
    const [keepEditorInFocus, setKeepEditorInFocus] = useState(false);
    const stagedAttributes = useStagedPostAttributes();
    const clearStagedAttributes = stagedAttributes.clear;

    // Worked out once: the chips, the `+` in the action row and the add control
    // after the chips all read the same fields and the same permission answer.
    const composerAttributes = useComposerAttributes(channelId, stagedAttributes.values, stagedAttributes.added);

    const readOnlyChannel = !canPost || !writeAllowedByPolicy;
    const hasDraftMessage = Boolean(draft.message);
    const showFormattingBar = !isFormattingBarHidden && !readOnlyChannel;
    const enableSharedChannelsDMs = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true');
    const postAttributesEnabled = useSelector(isPostAttributesEnabled);
    const wysiwygEnabled = useSelector(getWysiwygEditorPreference);
    const ctrlSend = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'send_on_ctrl_enter'));
    const codeBlockOnCtrlEnter = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_ADVANCED_SETTINGS, 'code_block_ctrl_enter', true));
    const isDMOrGMRemote = isChannelShared && (channelType === Constants.DM_CHANNEL || channelType === Constants.GM_CHANNEL);

    if (draft.channelId !== channelId || draft.rootId !== rootId) {
        setDraft(draftFromStore);
    }

    const handleShowPreview = useCallback(() => {
        setShowPreview((prev) => !prev);
    }, []);

    const emitTypingEvent = useCallback(() => {
        GlobalActions.emitLocalUserTypingEvent(channelId, rootId);
    }, [channelId, rootId]);

    const handleDraftChange = useCallback((draftToChange: PostDraft, options: {instant?: boolean; show?: boolean} = {instant: false, show: false}) => {
        let prefix = StoragePrefixes.DRAFT;
        let suffix = draftToChange.channelId;
        if (draftToChange.rootId) {
            prefix = StoragePrefixes.COMMENT_DRAFT;
            suffix = draftToChange.rootId;
        }
        const key = storageKey || `${prefix}${suffix}`;

        const pendingSave = pendingDraftSave.current;
        if (pendingSave) {
            clearTimeout(pendingSave.timeout);
            pendingDraftSave.current = undefined;

            // A save still pending for another channel or thread is the only copy of that draft.
            if (pendingSave.key !== key) {
                pendingSave.save();
            }
        }

        // A draft for a channel or thread the user has left is saved right away, as leaving it does.
        const location = locationRef.current;
        const leftLocation = draftToChange.channelId !== location.channelId || draftToChange.rootId !== location.rootId;
        const instant = options.instant || leftLocation;
        const show = options.show || leftLocation;

        // A late async callback (slow submit, finished file upload) may call handleDraftChange
        // with the channelId/rootId captured when it started. If the user has since moved to
        // another channel or thread, do not overwrite the text they have typed here.
        setDraft((currentDraft) => {
            if (currentDraft.channelId !== draftToChange.channelId || currentDraft.rootId !== draftToChange.rootId) {
                // The current channel/thread has changed, so don't update the draft displayed to the user
                return currentDraft;
            }

            return draftToChange;
        });

        const saveDraft = () => {
            if (isPostDraftEmpty(draftToChange)) {
                dispatch(removeDraft(key, draftToChange.channelId, draftToChange.rootId));
                return;
            }

            // Editing an existing post must never create a synced/visible draft. Edit
            // content is only persisted locally under the edit_draft_* key, so skip the
            // show + server-upsert paths that would surface it in the drafts UI.
            if (isInEditMode) {
                dispatch(updateDraft(key, draftToChange, draftToChange.rootId));
                return;
            }

            if (show) {
                dispatch(updateDraft(key, {...draftToChange, show: true}, draftToChange.rootId, true));
                return;
            }

            dispatch(updateDraft(key, draftToChange, draftToChange.rootId));
        };

        if (instant) {
            saveDraft();
        } else {
            const timeout = setTimeout(() => {
                pendingDraftSave.current = undefined;
                saveDraft();
            }, Constants.SAVE_DRAFT_TIMEOUT);
            pendingDraftSave.current = {key, save: saveDraft, timeout};
        }

        storedDrafts.current[draftToChange.rootId || draftToChange.channelId] = draftToChange;
    }, [dispatch, isInEditMode, locationRef, storageKey]);

    const applyFormatting = useCallback((mode: MarkdownMode) => {
        if (showPreview) {
            return;
        }

        if (wysiwygEnabled) {
            const editor = wysiwygRef.current?.getEditor();
            if (!editor || editor.isDestroyed) {
                return;
            }
            if (mode === 'link') {
                formattingBarRef.current?.openLinkPopover();
                return;
            }
            applyWysiwygFormatting(editor, mode);
            return;
        }

        const input = textboxRef.current?.getInputBox();
        if (!input) {
            return;
        }
        const res = applyMarkdownUtil({
            markdownMode: mode,
            selectionStart: input.selectionStart ?? 0,
            selectionEnd: input.selectionEnd ?? 0,
            message: input.value ?? '',
        });

        if (!replaceTextboxValue(input, res.message)) {
            handleDraftChange({
                ...draftRef.current,
                message: res.message,
            });
        }

        setTimeout(() => {
            const textbox = textboxRef.current?.getInputBox();
            if (textbox) {
                Utils.setSelectionRange(textbox, res.selectionStart, res.selectionEnd);
            }
        });
    }, [showPreview, wysiwygEnabled, handleDraftChange]);

    const toggleAdvanceTextEditor = useCallback(() => {
        dispatch(savePreferences(currentUserId, [{
            category: Preferences.ADVANCED_TEXT_EDITOR,
            user_id: currentUserId,

            // name: isRHS ? AdvancedTextEditorConst.COMMENT : AdvancedTextEditorConst.POST,
            name: getFormattingBarPreferenceName(),
            value: String(!isFormattingBarHidden),
        }]));
    }, [dispatch, currentUserId, getFormattingBarPreferenceName, isFormattingBarHidden]);

    const pluginItems = usePluginItems(draft, textboxRef, handleDraftChange);
    const focusTextbox = useTextboxFocus(textboxRef, channelId, isRHS, canPost, wysiwygRef);
    const {
        rewriteMenuProps,
        isProcessing: rewriteIsProcessing,
    } = useRewrite(draft, handleDraftChange, textboxRef, focusTextbox, setServerError);
    const hasAIActionsMenu = (aiActionMenuItems?.length ?? 0) > 0 || (aiRewriteEnabled && Boolean(rewriteMenuProps));
    const isDisabled = Boolean(readOnlyChannel || (!enableSharedChannelsDMs && isDMOrGMRemote) || rewriteIsProcessing);

    usePendingQuote(draft, handleDraftChange, channelId, rootId, isInEditMode, isDisabled, rewriteIsProcessing, textboxRef, wysiwygRef);

    const [attachmentPreview, fileUploadJSX] = useUploadFiles(
        draft,
        rootId,
        channelId,
        isThreadView,
        storedDrafts,
        isDisabled,
        editorBodyRef,
        handleDraftChange,
        focusTextbox,
        setServerError,
        isInEditMode,
        testIdScope,
    );

    const insertWysiwygText = useCallback((text: string) => {
        wysiwygRef.current?.insertText(text);
    }, []);

    const {
        emojiPicker,
        enableEmojiPicker,
        toggleEmojiPicker,
    } = useEditorEmojiPicker(
        textboxId,
        isDisabled,
        showPreview,
        testIdScope,
        wysiwygEnabled ? insertWysiwygText : undefined,
    );
    const {
        labels: priorityLabels,
        additionalControl: priorityAdditionalControl,
        isValidPersistentNotifications,
        onSubmitCheck: prioritySubmitCheck,
    } = usePriority(draft, handleDraftChange, focusTextbox, showPreview, false, testIdScope ? `${testIdScope}.priority_labels` : undefined);

    // The server refuses a burn-on-read post with attributes, every time, so
    // the composer doesn't let the two meet: a staged chip disables
    // burn-on-read, and burn-on-read disables adding attributes. Any chip, not
    // only one with a value, since an empty text chip can still be filled in.
    const burnOnReadBlockedReason = postAttributesEnabled && composerAttributes.chips.length > 0 ? formatMessage({
        id: 'post_attributes.composer.cannot_burn_on_read',
        defaultMessage: 'Messages with attributes can’t be burn-on-read',
        description: 'Tooltip on the disabled burn-on-read button in the message composer while attributes are attached to the message being written.',
    }) : undefined;
    const {
        labels: burnOnReadLabels,
        additionalControl: burnOnReadAdditionalControl,
        isBurnOnReadSendable: burnOnReadSendable,
        hasBurnOnReadSet,
    } = useBurnOnRead(draft, handleDraftChange, focusTextbox, showPreview, false, burnOnReadBlockedReason, testIdScope);
    const addAttributesBlockedReason = hasBurnOnReadSet ? formatMessage({
        id: 'post_attributes.composer.cannot_add_burn_on_read',
        defaultMessage: 'Burn-on-read messages can’t have attributes',
        description: 'Tooltip on the disabled button for adding attributes in the message composer while the message being written is set to burn-on-read.',
    }) : undefined;
    const [handleSubmit, errorClass] = useSubmit(
        draft,
        postError,
        channelId,
        rootId,
        serverError,
        lastBlurAt,
        focusTextbox,
        setServerError,
        setShowPreview,
        handleDraftChange,
        prioritySubmitCheck,
        clearStagedAttributes,
        afterSubmit,
        undefined,
        isInEditMode,
        postId,
        composerAttributes.values,
    );

    const handleSubmitWithErrorHandling = useCallback((submittingDraft?: PostDraft, schedulingInfo?: SchedulingInfo, options?: CreatePostOptions) => {
        const announceMessageSent = () => {
            const messageStatusElement = messageStatusRef.current;
            if (!messageStatusElement) {
                return;
            }
            if (messageStatusElement.textContent === 'Message Sent') {
                messageStatusElement.textContent = 'Message Sent &nbsp;';
            } else {
                messageStatusElement.textContent = 'Message Sent';
            }
        };

        const result = handleSubmit(submittingDraft, schedulingInfo, options);
        if (errorClass) {
            return result;
        }

        if (!schedulingInfo) {
            announceMessageSent();
            return result;
        }

        return result.then((response) => {
            if (!response?.error && !response?.skipped) {
                announceMessageSent();
            }
            return response;
        });
    }, [errorClass, handleSubmit]);

    const handleCancel = useCallback(() => {
        handleDraftChange({
            message: '',
            fileInfos: [],
            uploadsInProgress: [],
            createAt: 0,
            updateAt: 0,
            channelId,
            rootId,
            metadata: {},
        });
    }, [handleDraftChange, channelId, rootId]);

    // Unified handler to remove all labels (priority + burn on read)
    const handleRemoveAllLabels = useCallback(() => {
        // Remove priority from metadata and burn-on-read type
        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
        const {priority: _priority, ...restMetadata} = draft.metadata || {};

        const updatedDraft = {
            ...draft,
            type: undefined, // Remove burn-on-read type
            metadata: restMetadata, // Remove priority from metadata
        };

        handleDraftChange(updatedDraft, {instant: true});
        focusTextbox();
    }, [draft, handleDraftChange, focusTextbox]);

    const isDraftSendable = isValidPersistentNotifications && burnOnReadSendable;

    const handleSubmitWrapper = useCallback(() => {
        if (readOnlyChannel) {
            return;
        }

        const isEmptyPost = isPostDraftEmpty(draft);

        if (isInEditMode && isEmptyPost) {
            const deletePostModalData = {
                modalId: ModalIdentifiers.DELETE_POST,
                dialogType: DeletePostModal,
                dialogProps: {
                    post: draft,
                    isRHS,
                },
            };

            dispatch(openModal(deletePostModalData));
            return;
        }

        // useKeyHandler prevents submits already when draft isn't sendable,
        // but wysiwyg editor does not useKeyHandler, so check here too.
        // Don't gate in edit mode because that could break the ability to remove mentions
        // on an existing post with persistent notifications
        if (!isInEditMode && !isDraftSendable) {
            return;
        }

        handleSubmitWithErrorHandling();
    }, [dispatch, draft, handleSubmitWithErrorHandling, isInEditMode, isRHS, readOnlyChannel, isDraftSendable]);

    const [handleKeyDown, postMsgKeyPress] = useKeyHandler(
        draft,
        channelId,
        rootId,
        isDraftSendable,
        location,
        textboxRef,
        showFormattingBar,
        focusTextbox,
        applyFormatting,
        handleDraftChange,
        handleSubmitWrapper,
        emitTypingEvent,
        handleShowPreview,
        toggleAdvanceTextEditor,
        toggleEmojiPicker,
        isInEditMode,
        handleCancel,
    );

    const handleSubmitWithEvent = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (readOnlyChannel) {
            return;
        }
        handleSubmitWithErrorHandling();
    }, [handleSubmitWithErrorHandling, readOnlyChannel]);

    const handlePostError = useCallback((err: React.ReactNode) => {
        setPostError(err);
    }, []);

    const handleHeightChange = useCallback((height: number, maxHeight: number) => {
        setRenderScrollbar(height > maxHeight);
    }, []);

    const handleBlur = useCallback(() => {
        lastBlurAt.current = Date.now();
        setKeepEditorInFocus(false);
    }, []);

    const handleFocus = useCallback(() => {
        setKeepEditorInFocus(true);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const message = e.target.value;

        if (!isErrorInvalidSlashCommand(serverError)) {
            setServerError(null);
        }

        handleDraftChange({
            ...draft,
            message,
        });
    }, [draft, handleDraftChange, serverError]);

    const handleWysiwygChange = useCallback((markdown: string) => {
        emitTypingEvent();
        if (!isErrorInvalidSlashCommand(serverError)) {
            setServerError(null);
        }
        handleDraftChange({
            ...draft,
            message: markdown,
        });
    }, [draft, handleDraftChange, serverError, emitTypingEvent]);

    const getSelectedText = useCallback(() => {
        const input = textboxRef.current?.getInputBox();
        return {
            start: input?.selectionStart ?? 0,
            end: input?.selectionEnd ?? 0,
        };
    }, [textboxRef]);

    const updateText = useCallback((message: string) => {
        handleDraftChange({
            ...draftRef.current,
            message,
        });
    }, [handleDraftChange]);

    const handleWidthChange = useCallback((width: number) => {
        const input = textboxRef.current?.getInputBox();
        if (!editorBodyRef.current || !editorActionsRef.current || !input) {
            return;
        }

        const maxWidth = editorBodyRef.current.offsetWidth - editorActionsRef.current.offsetWidth;

        if (!hasDraftMessage) {
            // if we do not have a message we can just render the default state
            setIsMessageLong(false);
            return;
        }

        if (width >= maxWidth) {
            setIsMessageLong(true);
        } else {
            setIsMessageLong(false);
        }
    }, [hasDraftMessage]);

    const prefillMessage = useCallback((message: string) => {
        handleDraftChange({
            ...draft,
            message,
        });

        const inputBox = textboxRef.current?.getInputBox();
        inputBox?.click();
        focusTextbox(true);
    }, [handleDraftChange, focusTextbox, draft, textboxRef]);

    // Handle width change when there is no message.
    useEffect(() => {
        if (!hasDraftMessage) {
            handleWidthChange(0);
        }
    }, [hasDraftMessage, handleWidthChange]);

    // Clear timeout on unmount
    useEffect(() => {
        return () => loggedInAriaLabelTimeout.current && clearTimeout(loggedInAriaLabelTimeout.current);
    }, []);

    // Focus textbox when we stop showing the preview
    useDidUpdate(() => {
        if (!showPreview) {
            focusTextbox();
        }
    }, [showPreview]);

    // Focus textbox when selectedPostFocussedAt changes
    useEffect(() => {
        if (selectedPostFocussedAt) {
            focusTextbox();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPostFocussedAt]);

    // Remove show preview when we switch channels or posts
    useEffect(() => {
        setShowPreview(false);
        setServerError(null);
    }, [channelId, rootId]);

    // Attribute values are composer state, not part of the draft, so
    // switching channel or thread has to discard them explicitly.
    useEffect(() => {
        clearStagedAttributes();
    }, [channelId, rootId, clearStagedAttributes]);

    // Register listener to store the draft when the page unloads
    useEffect(() => {
        const callback = () => handleDraftChange(draft, {instant: true, show: true});
        window.addEventListener('beforeunload', callback);
        return () => {
            window.removeEventListener('beforeunload', callback);
        };
    }, [handleDraftChange, draft]);

    // Keep track of the draft as a ref so that we can save it when changing channels
    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    const handleSubmitPostAndScheduledMessage = useCallback((schedulingInfo?: SchedulingInfo) => {
        return handleSubmitWithErrorHandling(undefined, schedulingInfo);
    }, [handleSubmitWithErrorHandling]);

    // Store the previous draft when changing post or channels
    useEffect(() => {
        // Store the draft that existed when we opened the channel to know if it should be saved
        const draftOnOpen = draftFromStore;

        return () => {
            if (draftOnOpen !== draftRef.current) {
                handleDraftChange(draftRef.current, {instant: true, show: true});
            }
        };
    }, [channelId, rootId]);

    const disableSendButton = Boolean(isDisabled || (!draft.message.trim().length && !draft.fileInfos.length)) || !isDraftSendable;
    const schedulingBlockedReason = composerAttributes.values.length > 0 ? formatMessage({
        id: 'post_attributes.composer.cannot_schedule',
        defaultMessage: 'Messages with attributes can’t be scheduled',
        description: 'Tooltip on the disabled schedule button in the message composer while attributes are attached to the message being written.',
    }) : undefined;
    const sendButton = readOnlyChannel || isInEditMode ? null : (
        <SendButton
            testId={testIdScope ? `${testIdScope}.send` : undefined}
            disabled={disableSendButton}
            handleSubmit={handleSubmitPostAndScheduledMessage}
            channelId={channelId}
            repeatDisabledReason={getDraftRepeatDisabledReason(draft)}
            schedulingBlockedReason={schedulingBlockedReason}
        />
    );

    const showFormatJSX = (disableSendButton || wysiwygEnabled) ? null : (
        <ShowFormat
            onClick={handleShowPreview}
            active={showPreview}
            testId={testIdScope ? `${testIdScope}.preview` : undefined}
        />
    );

    let createMessage;
    if (placeholder) {
        createMessage = placeholder;
    } else if (!rootId && !isDisabled) {
        createMessage = formatMessage(
            {
                id: 'create_post.write',
                defaultMessage: 'Write to {channelDisplayName}',
            },
            {channelDisplayName},
        );
    } else if (!writeAllowedByPolicy) {
        createMessage = formatMessage(
            {
                id: 'create_post.write_access_denied',
                defaultMessage: 'You do not have permission to post in this channel.',
            },
        );
    } else if (readOnlyChannel) {
        createMessage = formatMessage(
            {
                id: 'create_post.read_only',
                defaultMessage: 'This channel is read-only. Only members with permission can post here.',
            },
        );
    } else if (!enableSharedChannelsDMs && isDMOrGMRemote) {
        createMessage = formatMessage(
            {
                id: 'create_post.dm_or_gm_remote',
                defaultMessage: 'Direct Messages and Group Messages with remote users are not supported.',
            },
        );
    } else {
        createMessage = formatMessage({id: 'create_comment.addComment', defaultMessage: 'Reply to this thread...'});
    }

    // Let plugins append to or replace the composer placeholder for this channel (e.g. an encryption
    // marker). Called here, after every branch has set the base placeholder.
    createMessage = useComposerPlaceholder(channelId, createMessage);

    const messageValue = isDisabled && !rewriteIsProcessing ? '' : draft.message_source || draft.message;

    const wasNotifiedOfLogIn = LocalStorageStore.getWasNotifiedOfLogIn();

    let loginSuccessfulLabel;
    if (!wasNotifiedOfLogIn) {
        loginSuccessfulLabel = formatMessage({
            id: 'channelView.login.successful',
            defaultMessage: 'Login Successful',
        });

        // set timeout to make sure aria-label is read by a screen reader,
        // and then set the flag to "true" to make sure it's not read again until a user logs back in
        if (!loggedInAriaLabelTimeout.current) {
            loggedInAriaLabelTimeout.current = setTimeout(() => {
                LocalStorageStore.setWasNotifiedOfLogIn(true);
            }, 3000);
        }
    }

    const ariaLabelMessageInput = formatMessage({
        id: 'accessibility.sections.centerFooter',
        defaultMessage: 'message input complementary region',
    });

    const ariaLabel = loginSuccessfulLabel ? `${loginSuccessfulLabel} ${ariaLabelMessageInput}` : ariaLabelMessageInput;

    const additionalControls = useMemo(() => [
        !isInEditMode && priorityAdditionalControl,
        !isInEditMode && burnOnReadAdditionalControl,
        ...(pluginItems || []),
    ].filter(Boolean), [pluginItems, priorityAdditionalControl, isInEditMode, burnOnReadAdditionalControl]);

    const aiActionsMenu = useMemo(() => {
        if (!hasAIActionsMenu) {
            return null;
        }

        return (
            <AIActionsMenu
                draft={draft}
                getSelectedText={getSelectedText}
                updateText={updateText}
                channelId={channelId}
                isRHS={location === Locations.RHS_COMMENT}
                rewriteMenuProps={rewriteMenuProps}
                aiRewriteEnabled={aiRewriteEnabled}
                testIdScope={testIdScope ? `${testIdScope}.ai_actions` : undefined}
            />
        );
    }, [draft, getSelectedText, updateText, channelId, location, rewriteMenuProps, aiRewriteEnabled, hasAIActionsMenu, testIdScope]);

    const formattingBar = (
        <AutoHeightSwitcher
            showSlot={showFormattingBar ? 1 : 2}
            slot1={(
                <FormattingBar
                    testId={testIdScope ? `${testIdScope}.formatting_bar` : undefined}
                    ref={formattingBarRef}
                    applyFormatting={applyFormatting}
                    disableControls={showPreview}
                    additionalControls={additionalControls}
                    location={location}
                    aiActionsMenu={aiActionsMenu}
                    getEditor={wysiwygEnabled ? () => wysiwygRef.current?.getEditor() ?? null : undefined}
                />
            )}
            slot2={null}
            shouldScrollIntoView={keepEditorInFocus}
        />
    );

    const fileUploadOverlay = useMemo(() => {
        const overlayType = isRHS ? 'right' : 'center';
        const direction = 'horizontal';

        return isInEditMode ? (
            <FileUploadOverlay
                overlayType={overlayType}
                isInEditMode={true}
                id={DropOverlayIdEditPost}
                direction={direction}
            />
        ) : (
            <FileUploadOverlay
                overlayType={overlayType}
                isInEditMode={false}
                id={isRHS ? DropOverlayIdCreateComment : DropOverlayIdCreatePost}
                direction={direction}
            />
        );
    }, [isInEditMode, isRHS]);

    const showFormattingSpacer = isMessageLong || showPreview || attachmentPreview || isRHS || isThreadView;

    const containsAtMentionsInMessage = allAtMentions(draft?.message)?.length > 0;

    return (
        <form
            id={rootId ? undefined : 'create_post'}
            data-testid={testIdScope}
            className={(!rootId && !fullWidthTextBox) ? 'center' : undefined}
            onSubmit={handleSubmitWithEvent}
        >
            {showDndWarning && <DoNotDisturbWarning displayName={teammateDisplayName}/>}
            {showOooWarning && (
                <OutOfOfficeWarning
                    testId={testIdScope ? `${testIdScope}.out_of_office_warning` : undefined}
                    displayName={teammateDisplayName}
                />
            )}
            {!isInEditMode && (
                <PostBoxIndicator
                    channelId={channelId}
                    teammateDisplayName={teammateDisplayName}
                    location={location}
                    postId={rootId}
                    hideRemoteUserHour={showOooWarning}
                />
            )}
            {postAttributesEnabled && !isInEditMode && composerAttributes.chips.length > 0 && (
                <div className='AdvancedTextEditor__attributes'>
                    <PostAttributesComposer
                        chips={composerAttributes.chips}
                        addable={composerAttributes.addable}
                        justAdded={stagedAttributes.justAdded}
                        onAdd={stagedAttributes.add}
                        onChange={stagedAttributes.change}
                        onRemove={stagedAttributes.remove}
                        testIdScope={testIdScope ? `${testIdScope}.post_attributes` : undefined}
                    />
                </div>
            )}
            <div
                className={classNames('AdvancedTextEditor', {
                    'AdvancedTextEditor__attachment-disabled': !canUploadFiles,
                    scroll: renderScrollbar,
                    'formatting-bar': showFormattingBar,
                })}
            >
                {!wasNotifiedOfLogIn && (
                    <div
                        aria-live='assertive'
                        className='sr-only'
                    >
                        <FormattedMessage
                            id='channelView.login.successful'
                            defaultMessage='Login Successful'
                        />
                    </div>
                )}
                <div
                    className={'AdvancedTextEditor__body'}
                    disabled={isDisabled}
                >
                    {fileUploadOverlay}
                    <div
                        ref={editorBodyRef}
                        role='application'
                        id='advancedTextEditorCell'
                        data-a11y-sort-order='2'
                        aria-label={ariaLabel}
                        tabIndex={-1}
                        className='AdvancedTextEditor__cell a11y__region'
                    >
                        {!isInEditMode && (priorityLabels || burnOnReadLabels) && (
                            <div className='AdvancedTextEditor__labels'>
                                <UnifiedLabelsWrapper
                                    priorityLabels={priorityLabels}
                                    burnOnReadLabels={burnOnReadLabels}
                                    onRemoveAll={handleRemoveAllLabels}
                                    canRemove={!showPreview}
                                    testIdScope={testIdScope}
                                />
                            </div>
                        )}
                        {wysiwygEnabled ? (
                            <WysiwygEditor
                                ref={wysiwygRef}
                                value={messageValue}
                                onChange={handleWysiwygChange}
                                onSubmit={handleSubmitWrapper}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                placeholder={createMessage}
                                channelId={channelId}
                                rootId={rootId}
                                id={textboxId}
                                testId={testIdScope ? `${testIdScope}.message` : undefined}
                                disabled={isDisabled && !rewriteIsProcessing}
                                useCtrlSend={ctrlSend}
                                sendCodeBlockOnCtrlEnter={codeBlockOnCtrlEnter}
                                onKeyDown={handleKeyDown as unknown as (e: React.KeyboardEvent<HTMLDivElement>) => void}
                            />
                        ) : (
                            <Textbox
                                hasLabels={isInEditMode ? false : Boolean(priorityLabels || burnOnReadLabels)}
                                suggestionList={location === Locations.RHS_COMMENT ? RhsSuggestionList : SuggestionList}
                                onChange={handleChange}
                                onKeyPress={postMsgKeyPress}
                                onKeyDown={handleKeyDown}
                                onCompositionUpdate={emitTypingEvent}
                                onHeightChange={handleHeightChange}
                                handlePostError={handlePostError}
                                value={messageValue}
                                onBlur={handleBlur}
                                onFocus={handleFocus}
                                emojiEnabled={enableEmojiPicker}
                                createMessage={createMessage}
                                channelId={channelId}
                                id={textboxId}
                                testId={testIdScope ? `${testIdScope}.message` : undefined}
                                ref={textboxRef!}
                                disabled={isDisabled && !rewriteIsProcessing}
                                characterLimit={maxPostSize}
                                preview={showPreview}
                                badConnection={badConnection}
                                useChannelMentions={useChannelMentions}
                                rootId={rootId}
                                onWidthChange={handleWidthChange}
                            />
                        )}
                        {attachmentPreview}
                        {!isDisabled && (showFormattingBar || showPreview) && (
                            <TexteditorActions
                                placement='top'
                                isScrollbarRendered={renderScrollbar}
                            >
                                {showFormatJSX}
                            </TexteditorActions>
                        )}
                        {showFormattingSpacer ? (
                            <FormattingBarSpacer>
                                {formattingBar}
                            </FormattingBarSpacer>
                        ) : formattingBar}
                        {!isDisabled && (
                            <TexteditorActions
                                ref={editorActionsRef}
                                placement='bottom'
                            >
                                {postAttributesEnabled && !isInEditMode && (
                                    <PostAttributesButton
                                        fields={composerAttributes.addable}
                                        onSelect={stagedAttributes.add}
                                        disabledReason={addAttributesBlockedReason}
                                        testIdScope={testIdScope ? `${testIdScope}.post_attributes_button` : undefined}
                                    />
                                )}
                                <ToggleFormattingBar
                                    onClick={toggleAdvanceTextEditor}
                                    active={showFormattingBar}
                                    disabled={showPreview}
                                />
                                <Separator data-testid={testIdScope ? `${testIdScope}.attachments_separator--separator` : undefined}/>
                                {fileUploadJSX}
                                {emojiPicker}
                                {sendButton}
                            </TexteditorActions>
                        )}
                    </div>
                    {showSendTutorialTip && (
                        <SendMessageTour
                            prefillMessage={prefillMessage}
                            channelId={channelId}
                            currentUserId={currentUserId}
                        />
                    )}
                </div>
            </div>
            {isInEditMode && containsAtMentionsInMessage && (
                <MessageWithMentionsFooter/>
            )}
            <Footer
                postError={postError}
                errorClass={errorClass}
                serverError={serverError}
                channelId={channelId}
                rootId={rootId}
                noArgumentHandleSubmit={handleSubmitWrapper}
                isInEditMode={isInEditMode}
                testIdScope={testIdScope}
            />
            {isInEditMode && (
                <EditPostFooter
                    onSave={handleSubmitWrapper}
                    onCancel={handleCancel}
                    disabled={readOnlyChannel}
                    testIdScope={testIdScope}
                />
            )}
            <div
                ref={messageStatusRef}
                aria-live='assertive'
                className='sr-only'
            />
        </form>
    );
};

export default AdvancedTextEditor;
