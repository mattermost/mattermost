// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';

import type {ChannelMemberCountsByGroup} from '@mattermost/types/channels';
import type {Emoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {FileInfo} from '@mattermost/types/files';
import {GroupSource} from '@mattermost/types/groups';
import type {Group} from '@mattermost/types/groups';
import type {PreferenceType} from '@mattermost/types/preferences';

import {Posts} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';
import {sortFileInfos} from 'mattermost-redux/utils/file_utils';

import * as GlobalActions from 'actions/global_actions';

import AdvancedTextEditor from 'components/advanced_text_editor/advanced_text_editor';
import FileLimitStickyBanner from 'components/file_limit_sticky_banner';
import type {FilePreviewInfo} from 'components/file_preview/file_preview';
import type {FileUpload as FileUploadClass} from 'components/file_upload/file_upload';
import NotifyConfirmModal from 'components/notify_confirm_modal';
import PostDeletedModal from 'components/post_deleted_modal';
import type {TextboxClass, TextboxElement} from 'components/textbox';

import Constants, {AdvancedTextEditor as AdvancedTextEditorConst, Locations, ModalIdentifiers, Preferences} from 'utils/constants';
import {
    applyMarkdown,
} from 'utils/markdown/apply_markdown';
import type {
    ApplyMarkdownOptions} from 'utils/markdown/apply_markdown';
import {
    specialMentionsInText,
    postMessageOnKeyPress,
    shouldFocusMainTextbox,
    isErrorInvalidSlashCommand,
    splitMessageBasedOnCaretPosition,
    groupsMentionedInText,
    mentionsMinusSpecialMentionsInText,
} from 'utils/post_utils';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {PostDraft} from 'types/store/draft';
import type {PluginComponent} from 'types/store/plugins';

export type Props = {
    currentTeamId: string;

    // The channel for which this comment is a part of
    channelId: string;

    // The id of the current user
    currentUserId: string;

    // The id of the parent post
    rootId: string;

    // The root message is deleted
    rootDeleted: boolean;

    // The number of channel members
    channelMembersCount: number;

    // The current history message selected
    messageInHistory?: string;

    // The current draft of the comment
    draft: PostDraft;

    // Data used for knowing if the draft came from a WS event
    isRemoteDraft: boolean;

    // Determines if the submit button should be rendered
    enableAddButton?: boolean;

    // Force message submission on CTRL/CMD + ENTER
    codeBlockOnCtrlEnter?: boolean;

    // Set to force form submission on CTRL/CMD + ENTER instead of just ENTER
    ctrlSend?: boolean;

    // The id of the latest post in this channel
    latestPostId?: string;

    // The current user locale
    locale: string;

    // Error id, if the post creation fails
    createPostErrorId?: string;

    // Determines if the current user can edit the post
    canPost: boolean;

    // Determines if the user is allowed to upload files
    canUploadFiles: boolean;

    // Called to clear file uploads in progress
    clearCommentDraftUploads: () => void;

    // Called when comment draft needs to be updated
    onUpdateCommentDraft: (draft?: PostDraft, save?: boolean) => void;

    // Called when comment draft needs to be updated for a specific root ID
    updateCommentDraftWithRootId: (rootID: string, draft: PostDraft, save?: boolean) => void;

    // Called when submitting the comment
    onSubmit: (draft: PostDraft, options: {ignoreSlash: boolean}) => void;

    // Called when resetting comment message history index
    onResetHistoryIndex: () => void;

    // Called when navigating back through comment message history
    moveHistoryIndexBack: (index: string) => Promise<ActionResult>;

    // Called when navigating forward through comment message history
    moveHistoryIndexForward: (index: string) => Promise<ActionResult>;

    // Called to initiate editing the user's latest post
    onEditLatestPost: () => ActionResult<boolean>;

    // Function to get the users timezones in the channel
    getChannelTimezones: (channelId: string) => Promise<ActionResult<string[]>>;

    // Reset state of createPost request
    resetCreatePostRequest: () => void;

    // Determines if @channel should warn in this channel
    enableConfirmNotificationsToChannel: boolean;

    // Determines if the emoji picker is enabled
    enableEmojiPicker: boolean;

    // Determines if the gif picker is enabled.
    enableGifPicker: boolean;

    // Determines if the connection may be bad to warn user
    badConnection: boolean;

    // Determines the maximum length of a post
    maxPostSize: number;

    // Determines if the RHS is in expanded state
    rhsExpanded: boolean;

    // The last time, if any, the selected post changed. Will be 0 if no post is selected.
    selectedPostFocussedAt: number;

    // Function to set or unset emoji picker for last message
    emitShortcutReactToLastPostFrom: (location: keyof typeof Constants.Locations) => void;

    // Determines if the current user can send special channel mentions
    useChannelMentions: boolean;

    // Determines if the current user can send LDAP group mentions
    useLDAPGroupMentions: boolean;

    // Set show preview for textbox
    setShowPreview: (showPreview: boolean) => void;

    // Determines if the preview should be shown
    shouldShowPreview: boolean;

    // Called when parent component should be scrolled to bottom
    scrollToBottom?: () => void;

    // Group member mention
    getChannelMemberCountsByGroup: (channelID: string) => void;
    groupsWithAllowReference: Map<string, Group> | null;
    channelMemberCountsByGroup: ChannelMemberCountsByGroup;
    focusOnMount?: boolean;
    isThreadView?: boolean;
    openModal: <P>(modalData: ModalData<P>) => void;
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<ActionResult>;
    useCustomGroupMentions: boolean;
    isFormattingBarHidden: boolean;
    searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<ActionResult>;
    postEditorActions: PluginComponent[];
    placeholder?: string;
    isPlugin?: boolean;
}

type State = {
    showEmojiPicker: boolean;
    uploadsProgressPercent: {[clientID: string]: FilePreviewInfo};
    renderScrollbar: boolean;
    scrollbarWidth: number;
    draft: PostDraft;
    rootId?: string;
    messageInHistory?: string;
    createPostErrorId?: string;
    caretPosition: number;
    postError?: React.ReactNode;
    errorClass: string | null;
    serverError: (ServerError & {submittedMessage?: string}) | null;
    showFormat: boolean;
    isFormattingBarHidden: boolean;
};

function isDraftEmpty(draft: PostDraft): boolean {
    return !draft || (!draft.message && draft.fileInfos.length === 0);
}

class AdvancedCreateComment extends React.PureComponent<Props, State> {
    // public because accessed in advanced_create_comment.test.tsx
    public draftsForPost: {[postID: string]: PostDraft | null} = {};
    public doInitialScrollToBottom = false;

    private readonly textboxRef: React.RefObject<TextboxClass>;

    private lastBlurAt = 0;
    private saveDraftFrame?: number | null;

    private isDraftSubmitting = false;
    private isDraftEdited = false;
    private isNonFormattedPaste = false;
    private timeoutId: number | null = null;

    private readonly fileUploadRef: React.RefObject<FileUploadClass>;

    static defaultProps = {
        focusOnMount: true,
    };

    static getDerivedStateFromProps(props: Props, state: State) {
        let updatedState: Partial<State> = {
            createPostErrorId: props.createPostErrorId,
            rootId: props.rootId,
            messageInHistory: props.messageInHistory,
        };

        const rootChanged = props.rootId !== state.rootId || props.draft.rootId !== state.draft?.rootId;
        const messageInHistoryChanged = props.messageInHistory !== state.messageInHistory;
        if (rootChanged || messageInHistoryChanged || (props.isRemoteDraft && props.draft.message !== state.draft?.message)) {
            updatedState = {
                ...updatedState,
                draft: {
                    ...props.draft,
                    uploadsInProgress: rootChanged ? [] : props.draft.uploadsInProgress,
                },
            };
        }

        return updatedState;
    }

    constructor(props: Props) {
        super(props);

        this.state = {
            showEmojiPicker: false,
            uploadsProgressPercent: {},
            renderScrollbar: false,
            scrollbarWidth: 0,
            errorClass: null,
            serverError: null,
            showFormat: false,
            isFormattingBarHidden: props.isFormattingBarHidden,
            caretPosition: props.draft.message.length,
            draft: {...props.draft, uploadsInProgress: []},
        };

        this.textboxRef = React.createRef();
        this.fileUploadRef = React.createRef();
    }

    componentDidMount() {
        const {clearCommentDraftUploads, onResetHistoryIndex, setShowPreview, draft} = this.props;
        clearCommentDraftUploads();
        onResetHistoryIndex();
        setShowPreview(false);

        if (this.props.focusOnMount) {
            this.focusTextbox();
        }

        document.addEventListener('keydown', this.focusTextboxIfNecessary);
        window.addEventListener('beforeunload', this.saveDraftWithShow);
        this.getChannelMemberCountsByGroup();

        // When draft.message is not empty, set doInitialScrollToBottom to true so that
        // on next component update, the actual this.scrollToBottom() will be called.
        // This is made so that the this.scrollToBottom() will be called only once.
        if (draft.message !== '') {
            this.doInitialScrollToBottom = true;
        }
    }

    componentWillUnmount() {
        this.props.resetCreatePostRequest?.();
        document.removeEventListener('keydown', this.focusTextboxIfNecessary);
        window.removeEventListener('beforeunload', this.saveDraftWithShow);
        this.saveDraftOnUnmount();
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (prevState.draft!.uploadsInProgress.length < this.state.draft!.uploadsInProgress.length && this.props.scrollToBottom) {
            this.props.scrollToBottom();
        }

        // Focus on textbox when emoji picker is closed
        if (prevState.showEmojiPicker && !this.state.showEmojiPicker) {
            this.focusTextbox();
        }

        // Focus on textbox when returned from preview mode
        if (prevProps.shouldShowPreview && !this.props.shouldShowPreview) {
            this.focusTextbox();
        }

        if (prevProps.rootId !== this.props.rootId || prevProps.selectedPostFocussedAt !== this.props.selectedPostFocussedAt) {
            this.getChannelMemberCountsByGroup();
            this.focusTextbox();
        }

        if (this.doInitialScrollToBottom) {
            if (this.props.scrollToBottom) {
                this.props.scrollToBottom();
            }
            this.doInitialScrollToBottom = false;
        }

        if (this.props.createPostErrorId === 'api.post.create_post.root_id.app_error' && this.props.createPostErrorId !== prevProps.createPostErrorId) {
            this.showPostDeletedModal();
        }
    }

    fillMessageFromHistory() {
        const lastMessage = this.props.messageInHistory;
        this.setState((prev) => ({
            draft: {
                ...prev.draft,
                message: lastMessage || '',
            },
        }));
    }

    loadPrevMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.moveHistoryIndexBack(Posts.MESSAGE_TYPES.COMMENT).then(() => this.fillMessageFromHistory());
    };

    loadNextMessage = (e: React.KeyboardEvent) => {
        e.preventDefault();
        this.props.moveHistoryIndexForward(Posts.MESSAGE_TYPES.COMMENT).then(() => this.fillMessageFromHistory());
    };

    getChannelMemberCountsByGroup = () => {
        const {useLDAPGroupMentions, useCustomGroupMentions, channelId, searchAssociatedGroupsForReference, getChannelMemberCountsByGroup, draft, currentTeamId} = this.props;

        if ((useLDAPGroupMentions || useCustomGroupMentions) && channelId) {
            const mentions = mentionsMinusSpecialMentionsInText(draft.message);

            if (mentions.length === 1) {
                searchAssociatedGroupsForReference(mentions[0], currentTeamId, channelId);
            } else if (mentions.length > 1) {
                getChannelMemberCountsByGroup(channelId);
            }
        }
    };

    saveDraftOnUnmount = () => {
        if (!this.isDraftEdited || !this.state.draft || this.props.rootDeleted) {
            return;
        }

        const updatedDraft = {
            ...this.state.draft,
            show: !isDraftEmpty(this.state.draft),
        } as PostDraft;

        this.props.onUpdateCommentDraft(updatedDraft, true);
    };

    saveDraftWithShow = () => {
        this.setState((prev) => {
            if (prev.draft) {
                return {
                    draft: {
                        ...prev.draft,
                        show: !isDraftEmpty(prev.draft),
                    } as PostDraft,
                };
            }

            return {
                draft: prev.draft,
            };
        }, () => {
            this.saveDraft(true);
        });
    };

    saveDraft = (save = false) => {
        if (this.saveDraftFrame) {
            clearTimeout(this.saveDraftFrame);
            this.props.onUpdateCommentDraft(this.state.draft, save);
            this.saveDraftFrame = null;
        }
    };

    setShowPreview = (newPreviewValue: boolean) => {
        this.props.setShowPreview(newPreviewValue);
    };

    focusTextboxIfNecessary = (e: KeyboardEvent) => {
        // Should only focus if RHS is expanded or if thread view
        if (!this.props.isThreadView && !this.props.rhsExpanded) {
            return;
        }

        // A bit of a hack to not steal focus from the channel switch modal if it's open
        // This is a special case as the channel switch modal does not enforce focus like
        // most modals do
        if (document.getElementsByClassName('channel-switch-modal').length) {
            return;
        }

        if (shouldFocusMainTextbox(e, document.activeElement)) {
            this.focusTextbox();
            this.toggleAdvanceTextEditor();
        }
    };

    setCaretPosition = (newCaretPosition: number) => {
        const textbox = this.textboxRef.current && this.textboxRef.current.getInputBox();

        this.setState({
            caretPosition: newCaretPosition,
        }, () => {
            Utils.setCaretPosition(textbox, newCaretPosition);
        });
    };

    handleNotifyAllConfirmation = () => {
        this.doSubmit();
    };

    showNotifyAllModal = (mentions: string[], channelTimezoneCount: number, memberNotifyCount: number) => {
        this.props.openModal({
            modalId: ModalIdentifiers.NOTIFY_CONFIRM_MODAL,
            dialogType: NotifyConfirmModal,
            dialogProps: {
                mentions,
                channelTimezoneCount,
                memberNotifyCount,
                onConfirm: () => this.handleNotifyAllConfirmation(),
                onExited: () => {
                    this.isDraftSubmitting = false;
                },
            },
        });
    };

    toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        const showEmojiPicker = !this.state.showEmojiPicker;
        this.setState({showEmojiPicker});
    };

    hideEmojiPicker = () => {
        this.setState({showEmojiPicker: false});
    };

    handleEmojiClick = (emoji: Emoji) => {
        const emojiAlias = getEmojiName(emoji);

        if (!emojiAlias) {
            //Oops... There went something wrong
            return;
        }

        const draft = this.state.draft!;

        let newMessage: string;
        if (draft.message === '') {
            newMessage = `:${emojiAlias}: `;
            this.setCaretPosition(newMessage.length);
        } else {
            const {message} = draft;
            const {firstPiece, lastPiece} = splitMessageBasedOnCaretPosition(this.state.caretPosition || 0, message);

            // check whether the first piece of the message is empty when cursor is placed at beginning of message and avoid adding an empty string at the beginning of the message
            newMessage = firstPiece === '' ? `:${emojiAlias}: ${lastPiece} ` : `${firstPiece} :${emojiAlias}: ${lastPiece} `;

            const newCaretPosition = firstPiece === '' ? `:${emojiAlias}: `.length : `${firstPiece} :${emojiAlias}: `.length;
            this.setCaretPosition(newCaretPosition);
        }

        const modifiedDraft = {
            ...draft,
            message: newMessage,
        };

        this.handleDraftChange(modifiedDraft);

        this.setState({
            showEmojiPicker: false,
            draft: modifiedDraft,
        });
    };

    handleGifClick = (gif: string) => {
        const draft = this.state.draft!;

        let newMessage: string;
        if (draft.message === '') {
            newMessage = gif;
        } else if ((/\s+$/).test(draft.message)) {
            // Check whether there is already a blank at the end of the current message
            newMessage = `${draft.message}${gif} `;
        } else {
            newMessage = `${draft.message} ${gif} `;
        }

        const modifiedDraft = {
            ...draft,
            message: newMessage,
        };

        this.handleDraftChange(modifiedDraft);

        this.setState({
            showEmojiPicker: false,
            draft: modifiedDraft,
        });

        this.focusTextbox();
    };

    handlePostError = (postError: React.ReactNode) => {
        this.setState({postError});
    };

    handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        this.setShowPreview(false);
        this.isDraftSubmitting = true;

        const {
            channelMembersCount,
            enableConfirmNotificationsToChannel,
            useChannelMentions,
            groupsWithAllowReference,
            channelMemberCountsByGroup,
            useLDAPGroupMentions,
            useCustomGroupMentions,
        } = this.props;
        const draft = this.state.draft!;
        const notificationsToChannel = enableConfirmNotificationsToChannel && useChannelMentions;
        let memberNotifyCount = 0;
        let channelTimezoneCount = 0;
        let mentions: string[] = [];

        const specialMentions = specialMentionsInText(draft.message);
        const hasSpecialMentions = Object.values(specialMentions).includes(true);

        if (enableConfirmNotificationsToChannel && !hasSpecialMentions && (useLDAPGroupMentions || useCustomGroupMentions)) {
            // Groups mentioned in users text
            const mentionGroups = groupsMentionedInText(draft.message, groupsWithAllowReference);
            if (mentionGroups.length > 0) {
                mentionGroups.
                    forEach((group) => {
                        if (group.source === GroupSource.Ldap && !useLDAPGroupMentions) {
                            return;
                        }
                        if (group.source === GroupSource.Custom && !useCustomGroupMentions) {
                            return;
                        }
                        const mappedValue = channelMemberCountsByGroup[group.id];
                        if (mappedValue && mappedValue.channel_member_count > Constants.NOTIFY_ALL_MEMBERS && mappedValue.channel_member_count > memberNotifyCount) {
                            memberNotifyCount = mappedValue.channel_member_count;
                            channelTimezoneCount = mappedValue.channel_member_timezones_count;
                        }
                        mentions.push(`@${group.name}`);
                    });
                mentions = [...new Set(mentions)];
            }
        }

        if (!useLDAPGroupMentions && !useCustomGroupMentions && mentions.length > 0) {
            const updatedDraft = {
                ...draft,
                props: {
                    ...draft.props,
                    disable_group_highlight: true,
                },
            };

            this.props.onUpdateCommentDraft(updatedDraft);
            this.setState({draft: updatedDraft});
        }

        if (notificationsToChannel &&
            channelMembersCount > Constants.NOTIFY_ALL_MEMBERS &&
            hasSpecialMentions) {
            memberNotifyCount = channelMembersCount - 1;
            for (const k in specialMentions) {
                if (specialMentions[k]) {
                    mentions.push('@' + k);
                }
            }

            const {data} = await this.props.getChannelTimezones(this.props.channelId);
            channelTimezoneCount = data ? data.length : 0;
        }

        if (!useChannelMentions && hasSpecialMentions) {
            const updatedDraft = {
                ...draft,
                props: {
                    ...draft.props,
                    mentionHighlightDisabled: true,
                },
            };

            this.props.onUpdateCommentDraft(updatedDraft);
            this.setState({draft: updatedDraft});
        }

        if (memberNotifyCount > 0) {
            this.showNotifyAllModal(mentions, channelTimezoneCount, memberNotifyCount);
            return;
        }

        await this.doSubmit(e);
    };

    doSubmit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }

        const draft = this.state.draft!;
        const enableAddButton = this.shouldEnableAddButton();

        if (!enableAddButton) {
            this.isDraftSubmitting = false;
            return;
        }

        if (draft.uploadsInProgress.length > 0) {
            this.isDraftSubmitting = false;
            return;
        }

        if (this.state.postError) {
            this.setState({errorClass: 'animation--highlight'});
            setTimeout(() => {
                this.setState({errorClass: null});
            }, Constants.ANIMATION_TIMEOUT);
            this.isDraftSubmitting = false;
            return;
        }

        if (this.props.rootDeleted) {
            this.showPostDeletedModal();
            this.isDraftSubmitting = false;
            return;
        }

        const fasterThanHumanWillClick = 150;
        const forceFocus = (Date.now() - this.lastBlurAt < fasterThanHumanWillClick);
        this.focusTextbox(forceFocus);

        const serverError = this.state.serverError;
        let ignoreSlash = false;
        if (isErrorInvalidSlashCommand(serverError) && draft.message === serverError?.submittedMessage) {
            ignoreSlash = true;
        }

        const options = {ignoreSlash};

        try {
            await this.props.onSubmit(draft, options);

            this.setState({
                postError: null,
                serverError: null,
                showFormat: false,
            });
        } catch (err: any) {
            if (isErrorInvalidSlashCommand(err)) {
                this.props.onUpdateCommentDraft(draft);
            }
            err.submittedMessage = draft.message;
            this.setState({serverError: err});
            this.isDraftSubmitting = false;
            return;
        }

        if (this.saveDraftFrame) {
            clearTimeout(this.saveDraftFrame);
        }

        this.isDraftSubmitting = false;
        this.setState({draft: {...this.props.draft, uploadsInProgress: []}});
        this.draftsForPost[this.props.rootId] = null;
    };

    commentMsgKeyPress = (e: React.KeyboardEvent<TextboxElement>) => {
        const {ctrlSend, codeBlockOnCtrlEnter} = this.props;

        const {allowSending} = postMessageOnKeyPress(
            e,
            this.state.draft!.message,
            Boolean(ctrlSend),
            Boolean(codeBlockOnCtrlEnter),
            0,
            0,
            this.state.caretPosition,
        );

        if (allowSending) {
            e.persist?.();

            this.isDraftSubmitting = true;
            this.textboxRef.current?.blur();
            this.handleSubmit(e);

            this.setShowPreview(false);
            setTimeout(() => {
                this.focusTextbox();
            });
        }

        this.emitTypingEvent();
    };

    reactToLastMessage = (e: React.KeyboardEvent<TextboxElement>) => {
        e.preventDefault();

        const {emitShortcutReactToLastPostFrom} = this.props;

        // Here we are not handling conditions such as check for modals,  popups etc. as shortcut is only trigger on
        // textbox input focus. Since all of them will already be closed as soon as they loose focus.
        emitShortcutReactToLastPostFrom(Locations.RHS_ROOT);
    };

    emitTypingEvent = () => {
        const {channelId, rootId} = this.props;
        GlobalActions.emitLocalUserTypingEvent(channelId, rootId);
    };

    handleChange = (e: React.ChangeEvent<TextboxElement>) => {
        const message = e.target.value;

        let serverError = this.state.serverError;
        if (isErrorInvalidSlashCommand(serverError)) {
            serverError = null;
        }

        const draft = this.state.draft!;
        const show = isDraftEmpty(draft) ? false : draft.show;
        const updatedDraft = {...draft, message, show};

        this.handleDraftChange(updatedDraft);

        this.setState({draft: updatedDraft, serverError}, () => {
            if (this.props.scrollToBottom) {
                this.props.scrollToBottom();
            }
        });
        this.draftsForPost[this.props.rootId] = updatedDraft;
    };

    handleDraftChange = (draft: PostDraft, rootId?: string, save = false, instant = false) => {
        this.isDraftEdited = true;

        if (this.saveDraftFrame) {
            clearTimeout(this.saveDraftFrame);
        }

        const saveDraft = () => {
            if (typeof rootId == 'undefined') {
                this.props.onUpdateCommentDraft(draft);
            } else {
                this.props.updateCommentDraftWithRootId(rootId, draft, save);
            }
        };

        if (instant) {
            saveDraft();
        } else {
            this.saveDraftFrame = window.setTimeout(() => {
                saveDraft();
            }, Constants.SAVE_DRAFT_TIMEOUT);
        }
        this.draftsForPost[this.props.rootId] = draft;
    };

    handleMouseUpKeyUp = (e: React.MouseEvent | React.KeyboardEvent) => {
        this.setState({
            caretPosition: (e.target as TextboxElement).selectionStart || 0,
        });
    };

    applyMarkdown = (options: ApplyMarkdownOptions) => {
        if (this.props.shouldShowPreview) {
            return;
        }

        const res = applyMarkdown(options);

        const draft = this.state.draft!;
        const modifiedDraft = {
            ...draft,
            message: res.message,
        };

        this.handleDraftChange(modifiedDraft);

        this.setState({
            draft: modifiedDraft,
        }, () => {
            const textbox = this.textboxRef.current?.getInputBox();
            Utils.setSelectionRange(textbox, res.selectionStart, res.selectionEnd);
        });
    };

    handleFileUploadChange = () => {
        this.isDraftEdited = true;
        this.focusTextbox();
    };

    handleUploadStart = (clientIds: string[]) => {
        const draft = this.state.draft!;
        const uploadsInProgress = [...draft.uploadsInProgress, ...clientIds];

        const modifiedDraft = {
            ...draft,
            uploadsInProgress,
        };
        this.props.onUpdateCommentDraft(modifiedDraft);
        this.setState({draft: modifiedDraft});
        this.draftsForPost[this.props.rootId] = modifiedDraft;

        // this is a bit redundant with the code that sets focus when the file input is clicked,
        // but this also resets the focus after a drag and drop
        this.focusTextbox();
    };

    handleUploadProgress = (filePreviewInfo: FilePreviewInfo) => {
        const uploadsProgressPercent = {...this.state.uploadsProgressPercent, [filePreviewInfo.clientId]: filePreviewInfo};
        this.setState({uploadsProgressPercent});
    };

    handleFileUploadComplete = (fileInfos: FileInfo[], clientIds: string[], _: string, rootId?: string) => {
        const draft = this.draftsForPost[rootId!]!;
        const uploadsInProgress = [...draft.uploadsInProgress];
        const newFileInfos = sortFileInfos([...draft.fileInfos, ...fileInfos], this.props.locale);

        // remove each finished file from uploads
        for (let i = 0; i < clientIds.length; i++) {
            const index = uploadsInProgress.indexOf(clientIds[i]);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
            }
        }

        const modifiedDraft = {
            ...draft,
            fileInfos: newFileInfos,
            uploadsInProgress,
        };
        this.handleDraftChange(modifiedDraft, rootId!, true, true);
        if (this.props.rootId === rootId) {
            this.setState({draft: modifiedDraft});
        }
    };

    handleUploadError = (uploadError: string | ServerError | null, clientId?: string, _?: string, rootId = '') => {
        if (clientId) {
            const draft = {...this.draftsForPost[rootId]!};
            const uploadsInProgress = [...draft.uploadsInProgress];

            const index = uploadsInProgress.indexOf(clientId as string);
            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
            }

            const modifiedDraft = {
                ...draft,
                uploadsInProgress,
            };
            this.props.updateCommentDraftWithRootId(rootId, modifiedDraft, true);
            this.draftsForPost[rootId] = modifiedDraft;
            if (this.props.rootId === rootId) {
                this.setState({draft: modifiedDraft});
            }
        }

        if (typeof uploadError === 'string') {
            if (uploadError.length !== 0) {
                this.setState({serverError: new Error(uploadError)});
            }
        } else {
            this.setState({serverError: uploadError});
        }
    };

    removePreview = (id: string) => {
        const draft = this.state.draft!;
        const fileInfos = [...draft.fileInfos];
        const uploadsInProgress = [...draft.uploadsInProgress];

        // Clear previous errors
        this.handleUploadError(null);

        // id can either be the id of an uploaded file or the client id of an in progress upload
        let index = fileInfos.findIndex((info) => info.id === id);
        if (index === -1) {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);

                if (this.fileUploadRef.current) {
                    this.fileUploadRef.current.cancelUpload(id);
                }
            }
        } else {
            fileInfos.splice(index, 1);
        }

        const modifiedDraft = {
            ...draft,
            fileInfos,
            uploadsInProgress,
        };

        this.props.onUpdateCommentDraft(modifiedDraft);
        this.setState({draft: modifiedDraft});
        this.draftsForPost[this.props.rootId] = modifiedDraft;

        this.handleFileUploadChange();

        if (this.saveDraftFrame) {
            clearTimeout(this.saveDraftFrame);
        }

        this.saveDraftFrame = window.setTimeout(() => {}, Constants.SAVE_DRAFT_TIMEOUT);
    };

    getFileUploadTarget = () => {
        return this.textboxRef.current?.getInputBox();
    };

    toggleAdvanceTextEditor = () => {
        this.setState({
            isFormattingBarHidden:
                !this.state.isFormattingBarHidden,
        });
        this.props.savePreferences(this.props.currentUserId, [{
            category: Preferences.ADVANCED_TEXT_EDITOR,
            user_id: this.props.currentUserId,
            name: AdvancedTextEditorConst.COMMENT,
            value: String(!this.state.isFormattingBarHidden),
        }]);
    };

    focusTextbox = (keepFocus = false) => {
        if (this.textboxRef.current && (keepFocus || !UserAgent.isMobile())) {
            this.textboxRef.current.focus();
        }
    };

    shouldEnableAddButton = () => {
        const {draft} = this.state;
        if (draft) {
            const message = draft.message ? draft.message.trim() : '';
            const fileInfos = draft.fileInfos ? draft.fileInfos : [];
            if (message.trim().length !== 0 || fileInfos.length !== 0) {
                return true;
            }
        }

        return isErrorInvalidSlashCommand(this.state.serverError);
    };

    showPostDeletedModal = () => {
        this.props.openModal({
            modalId: ModalIdentifiers.POST_DELETED_MODAL,
            dialogType: PostDeletedModal,
        });
    };

    handleBlur = () => {
        if (!this.isDraftSubmitting) {
            this.saveDraftWithShow();
        }
        this.lastBlurAt = Date.now();
    };

    handleEditLatestPost = () => {
        const {data: canEditNow} = this.props.onEditLatestPost();
        if (!canEditNow) {
            this.focusTextbox(true);
        }
    };

    onMessageChange = (message: string, callback?: (() => void) | undefined) => {
        const draft = this.state.draft;
        const modifiedDraft = {
            ...draft,
            message,
        };
        this.handleDraftChange(modifiedDraft);
        this.setState({
            draft: modifiedDraft,
        }, callback);
    };

    render() {
        const draft = this.state.draft!;

        const pluginItems = this.props.postEditorActions?.
            map((item) => {
                if (!item.component) {
                    return null;
                }

                const Component = item.component as any;
                return (
                    <Component
                        key={item.id}
                        draft={draft}
                        getSelectedText={() => {
                            const input = this.textboxRef.current?.getInputBox();

                            return {
                                start: input.selectionStart,
                                end: input.selectionEnd,
                            };
                        }}
                        updateText={(message: string) => {
                            const draft = this.state.draft!;
                            const modifiedDraft = {
                                ...draft,
                                message,
                            };
                            this.handleDraftChange(modifiedDraft);
                            this.setState({
                                draft: modifiedDraft,
                            });
                        }}
                    />
                );
            });

        return (
            <form onSubmit={this.handleSubmit}>
                {
                    this.props.canPost &&
                    (this.props.draft.fileInfos.length > 0 || this.props.draft.uploadsInProgress.length > 0) &&
                    <FileLimitStickyBanner/>
                }
                <AdvancedTextEditor
                    location={Locations.RHS_COMMENT}
                    textboxRef={this.textboxRef}
                    currentUserId={this.props.currentUserId}
                    message={draft.message}
                    showEmojiPicker={this.state.showEmojiPicker}
                    uploadsProgressPercent={this.state.uploadsProgressPercent}
                    channelId={this.props.channelId}
                    postId={this.props.rootId}
                    errorClass={this.state.errorClass}
                    serverError={this.state.serverError}
                    isFormattingBarHidden={this.state.isFormattingBarHidden}
                    draft={this.props.draft}
                    handleSubmit={this.handleSubmit}
                    removePreview={this.removePreview}
                    setShowPreview={this.setShowPreview}
                    shouldShowPreview={this.props.shouldShowPreview}
                    maxPostSize={this.props.maxPostSize}
                    canPost={this.props.canPost}
                    applyMarkdown={this.applyMarkdown}
                    useChannelMentions={this.props.useChannelMentions}
                    badConnection={this.props.badConnection}
                    canUploadFiles={this.props.canUploadFiles}
                    enableEmojiPicker={this.props.enableEmojiPicker}
                    enableGifPicker={this.props.enableGifPicker}
                    handleBlur={this.handleBlur}
                    postError={this.state.postError}
                    handlePostError={this.handlePostError}
                    emitTypingEvent={this.emitTypingEvent}
                    handleMouseUpKeyUp={this.handleMouseUpKeyUp}
                    postMsgKeyPress={this.commentMsgKeyPress}
                    handleChange={this.handleChange}
                    toggleEmojiPicker={this.toggleEmojiPicker}
                    handleGifClick={this.handleGifClick}
                    handleEmojiClick={this.handleEmojiClick}
                    hideEmojiPicker={this.hideEmojiPicker}
                    toggleAdvanceTextEditor={this.toggleAdvanceTextEditor}
                    handleUploadProgress={this.handleUploadProgress}
                    handleUploadError={this.handleUploadError}
                    handleFileUploadComplete={this.handleFileUploadComplete}
                    handleUploadStart={this.handleUploadStart}
                    handleFileUploadChange={this.handleFileUploadChange}
                    getFileUploadTarget={this.getFileUploadTarget}
                    fileUploadRef={this.fileUploadRef}
                    isThreadView={this.props.isThreadView}
                    additionalControls={pluginItems.filter(Boolean)}
                    codeBlockOnCtrlEnter={this.props.codeBlockOnCtrlEnter}
                    ctrlSend={this.props.ctrlSend}
                    loadNextMessage={this.loadNextMessage}
                    loadPrevMessage={this.loadPrevMessage}
                    onEditLatestPost={this.handleEditLatestPost}
                    onMessageChange={this.onMessageChange}
                    caretPosition={this.state.caretPosition}
                    placeholder={this.props.placeholder}
                />
            </form>
        );
    }
}

export default AdvancedCreateComment;
