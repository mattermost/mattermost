// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {lazy, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Permissions} from 'mattermost-redux/constants';
import {getChannel, makeGetChannel, getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {get, getBool, getInt} from 'mattermost-redux/selectors/entities/preferences';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId, isCurrentUserGuestUser, getStatusForUserId, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import * as GlobalActions from 'actions/global_actions';
import type {CreatePostOptions} from 'actions/post_actions';
import {actionOnGlobalItemsWithPrefix} from 'actions/storage';
import type {SubmitPostReturnType} from 'actions/views/create_comment';
import {removeDraft, updateDraft} from 'actions/views/drafts';
import {openModal} from 'actions/views/modals';
import {makeGetDraft} from 'selectors/drafts';
import {getSelectedPostFocussedAt} from 'selectors/rhs';
import {connectionErrorCount} from 'selectors/views/system';
import LocalStorageStore from 'stores/local_storage_store';

import PostBoxIndicator from 'components/advanced_text_editor/post_box_indicator/post_box_indicator';
import {makeAsyncComponent} from 'components/async_load';
import AutoHeightSwitcher from 'components/common/auto_height_switcher';
import useDidUpdate from 'components/common/hooks/useDidUpdate';
import DeletePostModal from 'components/delete_post_modal';
import {
    DropOverlayIdCreateComment,
    DropOverlayIdCreatePost,
    DropOverlayIdEditPost, FileUploadOverlay,
} from 'components/file_upload_overlay/file_upload_overlay';
import RhsSuggestionList from 'components/suggestion/rhs_suggestion_list';
import SuggestionList from 'components/suggestion/suggestion_list';
import Textbox from 'components/textbox';
import type {TextboxElement} from 'components/textbox';
import type TextboxClass from 'components/textbox/textbox';
import {OnboardingTourSteps, OnboardingTourStepsForGuestUsers, TutorialTourName} from 'components/tours/constant';
import {SendMessageTour} from 'components/tours/onboarding_tour';

import Constants, {
    Locations,
    StoragePrefixes,
    Preferences,
    AdvancedTextEditor as AdvancedTextEditorConst,
    UserStatuses,
    ModalIdentifiers,
    AdvancedTextEditorTextboxIds,
} from 'utils/constants';
import {canUploadFiles as canUploadFilesAccordingToConfig} from 'utils/file_utils';
import type {ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';
import {applyMarkdown as applyMarkdownUtil} from 'utils/markdown/apply_markdown';
import {isErrorInvalidSlashCommand} from 'utils/post_utils';
import {allAtMentions} from 'utils/text_formatting';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';
import {isPostDraftEmpty} from 'types/store/draft';

import DoNotDisturbWarning from './do_not_disturb_warning';
import EditPostFooter from './edit_post_footer';
import Footer from './footer';
import FormattingBar from './formatting_bar';
import {FormattingBarSpacer, Separator} from './formatting_bar/formatting_bar';
import MessageWithMentionsFooter from './message_with_mentions_footer';
import SendButton from './send_button';
import ShowFormat from './show_formatting';
import TexteditorActions from './texteditor_actions';
import ToggleFormattingBar from './toggle_formatting_bar';
import useEditorEmojiPicker from './use_editor_emoji_picker';
import useKeyHandler from './use_key_handler';
import useOrientationHandler from './use_orientation_handler';
import usePluginItems from './use_plugin_items';
import usePriority from './use_priority';
import useSubmit from './use_submit';
import useTextboxFocus from './use_textbox_focus';
import useUploadFiles from './use_upload_files';

import './advanced_text_editor.scss';

const FileLimitStickyBanner = makeAsyncComponent('FileLimitStickyBanner', lazy(() => import('components/file_limit_sticky_banner')));

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
}

const AdvancedTextEditor = ({
    location,
    channelId,
    rootId,
    postId,
    isThreadView = false,
    placeholder,
    isInEditMode = false,
    afterSubmit,
    storageKey,
}: Props) => {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const getChannelSelector = useMemo(makeGetChannel, []);
    const getDraftSelector = useMemo(makeGetDraft, []);
    const getDisplayName = useMemo(makeGetDisplayName, []);

    let textboxId: string;
    if (isInEditMode) {
        textboxId = AdvancedTextEditorTextboxIds.InEditMode;
    } else if (location === Locations.CENTER) {
        textboxId = AdvancedTextEditorTextboxIds.InCenter;
    } else if (location === Locations.RHS_COMMENT) {
        textboxId = AdvancedTextEditorTextboxIds.InRHSComment;
    } else if (location === Locations.MODAL) {
        textboxId = AdvancedTextEditorTextboxIds.InModal;
    } else {
        textboxId = AdvancedTextEditorTextboxIds.Default;
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
    const selectedPostFocussedAt = useSelector((state: GlobalState) => getSelectedPostFocussedAt(state));

    const canPost = useSelector((state: GlobalState) => {
        const channel = getChannel(state, channelId);
        return channel ? haveIChannelPermission(state, channel.team_id, channel.id, Permissions.CREATE_POST) : false;
    });
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
    const loggedInAriaLabelTimeout = useRef<NodeJS.Timeout>();
    const saveDraftFrame = useRef<NodeJS.Timeout>();
    const draftRef = useRef(draftFromStore);
    const storedDrafts = useRef<Record<string, PostDraft | undefined>>({});
    const lastBlurAt = useRef(0);
    const messageStatusRef = useRef<HTMLDivElement | null>(null);

    const [draft, setDraft] = useState(draftFromStore);
    const [caretPosition, setCaretPosition] = useState(draft.message.length);
    const [serverError, setServerError] = useState<(ServerError & { submittedMessage?: string }) | null>(null);
    const [postError, setPostError] = useState<React.ReactNode>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [isMessageLong, setIsMessageLong] = useState(false);
    const [renderScrollbar, setRenderScrollbar] = useState(false);
    const [keepEditorInFocus, setKeepEditorInFocus] = useState(false);

    const readOnlyChannel = !canPost;
    const hasDraftMessage = Boolean(draft.message);
    const showFormattingBar = !isFormattingBarHidden && !readOnlyChannel;
    const enableSharedChannelsDMs = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true');
    const isDMOrGMRemote = isChannelShared && (channelType === Constants.DM_CHANNEL || channelType === Constants.GM_CHANNEL);
    const isDisabled = Boolean(readOnlyChannel || (!enableSharedChannelsDMs && isDMOrGMRemote));

    const handleShowPreview = useCallback(() => {
        setShowPreview((prev) => !prev);
    }, []);

    const emitTypingEvent = useCallback(() => {
        GlobalActions.emitLocalUserTypingEvent(channelId, rootId);
    }, [channelId, rootId]);

    const handleDraftChange = useCallback((draftToChange: PostDraft, options: {instant?: boolean; show?: boolean} = {instant: false, show: false}) => {
        if (saveDraftFrame.current) {
            clearTimeout(saveDraftFrame.current);
        }

        setDraft(draftToChange);

        const saveDraft = () => {
            let prefix = StoragePrefixes.DRAFT;
            let suffix = draftToChange.channelId;
            if (draftToChange.rootId) {
                prefix = StoragePrefixes.COMMENT_DRAFT;
                suffix = draftToChange.rootId;
            }
            const key = storageKey || `${prefix}${suffix}`;

            if (isPostDraftEmpty(draftToChange)) {
                dispatch(removeDraft(key, draftToChange.channelId, draftToChange.rootId));
                return;
            }

            if (options.show) {
                dispatch(updateDraft(key, {...draftToChange, show: true}, draftToChange.rootId, true));
                return;
            }

            dispatch(updateDraft(key, draftToChange, draftToChange.rootId));
        };

        if (options.instant) {
            saveDraft();
        } else {
            saveDraftFrame.current = setTimeout(() => {
                saveDraft();
            }, Constants.SAVE_DRAFT_TIMEOUT);
        }

        storedDrafts.current[draftToChange.rootId || draftToChange.channelId] = draftToChange;
    }, [dispatch]);

    const applyMarkdown = useCallback((params: ApplyMarkdownOptions) => {
        if (showPreview) {
            return;
        }

        const res = applyMarkdownUtil(params);

        handleDraftChange({
            ...draft,
            message: res.message,
        });

        setTimeout(() => {
            const textbox = textboxRef.current?.getInputBox();
            Utils.setSelectionRange(textbox, res.selectionStart, res.selectionEnd);
        });
    }, [showPreview, handleDraftChange, draft]);

    const toggleAdvanceTextEditor = useCallback(() => {
        dispatch(savePreferences(currentUserId, [{
            category: Preferences.ADVANCED_TEXT_EDITOR,
            user_id: currentUserId,

            // name: isRHS ? AdvancedTextEditorConst.COMMENT : AdvancedTextEditorConst.POST,
            name: getFormattingBarPreferenceName(),
            value: String(!isFormattingBarHidden),
        }]));
    }, [dispatch, currentUserId, getFormattingBarPreferenceName, isFormattingBarHidden]);

    useOrientationHandler(textboxRef, rootId);
    const pluginItems = usePluginItems(draft, textboxRef, handleDraftChange);
    const focusTextbox = useTextboxFocus(textboxRef, channelId, isRHS, canPost);
    const [attachmentPreview, fileUploadJSX] = useUploadFiles(
        draft,
        rootId,
        channelId,
        isThreadView,
        storedDrafts,
        isDisabled,
        textboxRef,
        handleDraftChange,
        focusTextbox,
        setServerError,
        isInEditMode,
    );

    const {
        emojiPicker,
        enableEmojiPicker,
        toggleEmojiPicker,
    } = useEditorEmojiPicker(
        textboxId,
        isDisabled,
        draft,
        caretPosition,
        setCaretPosition,
        handleDraftChange,
        showPreview,
        focusTextbox,
    );
    const {
        labels: priorityLabels,
        additionalControl: priorityAdditionalControl,
        isValidPersistentNotifications,
        onSubmitCheck: prioritySubmitCheck,
    } = usePriority(draft, handleDraftChange, focusTextbox, showPreview);
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
        undefined,
        afterSubmit,
        undefined,
        isInEditMode,
        postId,
    );

    const handleSubmitWithErrorHandling = useCallback((submittingDraft?: PostDraft, schedulingInfo?: SchedulingInfo, options?: CreatePostOptions) => {
        handleSubmit(submittingDraft, schedulingInfo, options);
        if (!errorClass) {
            const messageStatusElement = messageStatusRef.current;
            const messageStatusInnerText = messageStatusElement?.textContent;
            if (messageStatusInnerText === 'Message Sent') {
                messageStatusElement!.textContent = 'Message Sent &nbsp;';
            } else {
                messageStatusElement!.textContent = 'Message Sent';
            }
        }
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

    const handleSubmitWrapper = useCallback(() => {
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

        handleSubmitWithErrorHandling();
    }, [dispatch, draft, handleSubmitWithErrorHandling, isInEditMode, isRHS]);

    const [handleKeyDown, postMsgKeyPress] = useKeyHandler(
        draft,
        channelId,
        rootId,
        caretPosition,
        isValidPersistentNotifications,
        location,
        textboxRef,
        showFormattingBar,
        focusTextbox,
        applyMarkdown,
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
        handleSubmitWithErrorHandling();
    }, [handleSubmitWithErrorHandling]);

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

    /**
     * by getting the value directly from the textbox we eliminate all unnecessary
     * re-renders for the FormattingBar component. The previous method of always passing
     * down the current message value that came from the parents state was not optimal,
     * although still working as expected
     */
    const getCurrentValue = useCallback(() => textboxRef.current?.getInputBox().value, [textboxRef]);

    const getCurrentSelection = useCallback(() => {
        const input = textboxRef.current?.getInputBox();

        return {
            start: input.selectionStart,
            end: input.selectionEnd,
        };
    }, [textboxRef]);

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

    const handleMouseUpKeyUp = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
        setCaretPosition((e.target as TextboxElement).selectionStart || 0);
    }, []);

    const prefillMessage = useCallback((message: string, shouldFocus?: boolean) => {
        handleDraftChange({
            ...draft,
            message,
        });
        setCaretPosition(message.length);

        if (shouldFocus) {
            const inputBox = textboxRef.current?.getInputBox();
            inputBox?.click();
            focusTextbox(true);
        }
    }, [handleDraftChange, focusTextbox, draft, textboxRef]);

    // Update the caret position in the input box when changed by a side effect
    useEffect(() => {
        const textbox: HTMLInputElement | HTMLTextAreaElement | undefined = textboxRef.current?.getInputBox();
        if (textbox && textbox.selectionStart !== caretPosition) {
            Utils.setCaretPosition(textbox, caretPosition);
        }
    }, [caretPosition]);

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

    // Remove uploads in progress on mount
    useEffect(() => {
        dispatch(actionOnGlobalItemsWithPrefix(rootId ? StoragePrefixes.COMMENT_DRAFT : StoragePrefixes.DRAFT, (_key: string, draft: PostDraft) => {
            if (!draft || !draft.uploadsInProgress || draft.uploadsInProgress.length === 0) {
                return draft;
            }

            return {...draft, uploadsInProgress: []};
        }));
    }, []);

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
        handleSubmitWithErrorHandling(undefined, schedulingInfo);
    }, [handleSubmitWithErrorHandling]);

    // Set the draft from store when changing post or channels, and store the previous one
    useEffect(() => {
        // Store the draft that existed when we opened the channel to know if it should be saved
        const draftOnOpen = draftFromStore;

        setDraft(draftOnOpen);

        return () => {
            if (draftOnOpen !== draftRef.current) {
                handleDraftChange(draftRef.current, {instant: true, show: true});
            }
        };
    }, [channelId, rootId]);

    const disableSendButton = Boolean(isDisabled || (!draft.message.trim().length && !draft.fileInfos.length)) || !isValidPersistentNotifications;
    const sendButton = readOnlyChannel || isInEditMode ? null : (
        <SendButton
            disabled={disableSendButton}
            handleSubmit={handleSubmitPostAndScheduledMessage}
            channelId={channelId}
        />
    );

    const showFormatJSX = disableSendButton ? null : (
        <ShowFormat
            onClick={handleShowPreview}
            active={showPreview}
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

    const messageValue = isDisabled ? '' : draft.message_source || draft.message;

    const wasNotifiedOfLogIn = LocalStorageStore.getWasNotifiedOfLogIn();

    let loginSuccessfulLabel;
    if (!wasNotifiedOfLogIn) {
        loginSuccessfulLabel = formatMessage({
            id: 'channelView.login.successfull',
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
        ...(pluginItems || []),
    ].filter(Boolean), [pluginItems, priorityAdditionalControl, isInEditMode]);

    const formattingBar = (
        <AutoHeightSwitcher
            showSlot={showFormattingBar ? 1 : 2}
            slot1={(
                <FormattingBar
                    applyMarkdown={applyMarkdown}
                    getCurrentMessage={getCurrentValue}
                    getCurrentSelection={getCurrentSelection}
                    disableControls={showPreview}
                    additionalControls={additionalControls}
                    location={location}
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
            data-testid={rootId ? undefined : 'create-post'}
            className={(!rootId && !fullWidthTextBox) ? 'center' : undefined}
            onSubmit={handleSubmitWithEvent}
        >
            {canPost && (draft.fileInfos.length > 0 || draft.uploadsInProgress.length > 0) && (
                <FileLimitStickyBanner/>
            )}
            {showDndWarning && <DoNotDisturbWarning displayName={teammateDisplayName}/>}
            {!isInEditMode && (
                <PostBoxIndicator
                    channelId={channelId}
                    teammateDisplayName={teammateDisplayName}
                    location={location}
                    postId={rootId}
                />
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
                            id='channelView.login.successfull'
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
                        {!isInEditMode && priorityLabels}
                        <Textbox
                            hasLabels={isInEditMode ? false : Boolean(priorityLabels)}
                            suggestionList={location === Locations.RHS_COMMENT ? RhsSuggestionList : SuggestionList}
                            onChange={handleChange}
                            onKeyPress={postMsgKeyPress}
                            onKeyDown={handleKeyDown}
                            onMouseUp={handleMouseUpKeyUp}
                            onKeyUp={handleMouseUpKeyUp}
                            onComposition={emitTypingEvent}
                            onHeightChange={handleHeightChange}
                            handlePostError={handlePostError}
                            value={messageValue}
                            onBlur={handleBlur}
                            onFocus={handleFocus}
                            emojiEnabled={enableEmojiPicker}
                            createMessage={createMessage}
                            channelId={channelId}
                            id={textboxId}
                            ref={textboxRef!}
                            disabled={isDisabled}
                            characterLimit={maxPostSize}
                            preview={showPreview}
                            badConnection={badConnection}
                            useChannelMentions={useChannelMentions}
                            rootId={rootId}
                            onWidthChange={handleWidthChange}
                            isInEditMode={isInEditMode}
                        />
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
                                <ToggleFormattingBar
                                    onClick={toggleAdvanceTextEditor}
                                    active={showFormattingBar}
                                    disabled={showPreview}
                                />
                                <Separator/>
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
            />
            {isInEditMode && (
                <EditPostFooter
                    onSave={handleSubmitWrapper}
                    onCancel={handleCancel}
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
