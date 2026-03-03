// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {
    ArrowRightBoldOutlineIcon,
    BookmarkIcon,
    BookmarkOutlineIcon,
    ContentCopyIcon,
    DotsHorizontalIcon,
    EmoticonPlusOutlineIcon,
    LinkVariantIcon,
    MarkAsUnreadIcon,
    MessageArrowRightOutlineIcon,
    MessageCheckOutlineIcon,
    MessageMinusOutlineIcon,
    PencilOutlineIcon,
    PinIcon,
    PinOutlineIcon,
    ReplyOutlineIcon,
    TranslateIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import Permissions from 'mattermost-redux/constants/permissions';

import {closeModal} from 'actions/views/modals';

import BurnOnReadConfirmationModal from 'components/burn_on_read_confirmation_modal';
import DeletePostModal from 'components/delete_post_modal';
import FlagPostModal from 'components/flag_message_modal/flag_post_modal';
import ForwardPostModal from 'components/forward_post_modal';
import * as Menu from 'components/menu';
import MoveThreadModal from 'components/move_thread_modal';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import {createBurnOnReadDeleteModalHandlers} from 'hooks/useBurnOnReadDeleteModal';
import {Locations, ModalIdentifiers, Constants} from 'utils/constants';
import DelayedAction from 'utils/delayed_action';
import * as Keyboard from 'utils/keyboard';
import * as PostUtils from 'utils/post_utils';
import * as Utils from 'utils/utils';

import type {ModalData} from 'types/actions';

import PostReminderSubMenu from './post_reminder_submenu';

import './dot_menu.scss';

type ChangeEvent = React.KeyboardEvent | React.MouseEvent;

type ShortcutKeyProps = {
    shortcutKey: string;
};

const ShortcutKey = ({shortcutKey: shortcut}: ShortcutKeyProps) => (
    <span>
        {shortcut}
    </span>
);

function getMessageToCopy(post: Post, isChannelAutotranslated: boolean, locale: string): string {
    const originalMessage = post.message_source || post.message;
    if (!isChannelAutotranslated || post.type !== '') {
        return originalMessage;
    }
    const translation = PostUtils.getPostTranslation(post, locale);
    if (!translation || translation.state !== 'ready') {
        return originalMessage;
    }
    return PostUtils.getPostTranslatedMessage(originalMessage, translation);
}

type Props = {
    intl: IntlShape;
    post: Post;
    teamId: string;
    location?: keyof typeof Constants.Locations;
    isFlagged?: boolean;
    handleCommentClick?: React.EventHandler<any>;
    handleDropdownOpened: (open: boolean) => void;
    handleAddReactionClick?: (showEmojiPicker: boolean) => void;
    isMenuOpen?: boolean;
    isReadOnly?: boolean;
    isLicensed?: boolean; // TechDebt: Made non-mandatory while converting to typescript
    postEditTimeLimit?: string; // TechDebt: Made non-mandatory while converting to typescript
    enableEmojiPicker?: boolean; // TechDebt: Made non-mandatory while converting to typescript
    channelIsArchived?: boolean; // TechDebt: Made non-mandatory while converting to typescript
    teamUrl?: string; // TechDebt: Made non-mandatory while converting to typescript
    isMobileView: boolean;
    timezone?: string;
    isMilitaryTime: boolean;
    canMove: boolean;
    canReply: boolean;
    canForward: boolean;
    canFollowThread: boolean;
    canPin: boolean;
    canCopyText: boolean;
    canCopyLink: boolean;
    canFlagContent?: boolean;

    actions: {

        /**
         * Function flag the post
         */
        flagPost: (postId: string) => void;

        /**
         * Function to unflag the post
         */
        unflagPost: (postId: string) => void;

        /**
         * Function to set the editing post
         */
        setEditingPost: (postId?: string, refocusId?: string, isRHS?: boolean) => void;

        /**
         * Function to pin the post
         */
        pinPost: (postId: string) => void;

        /**
         * Function to unpin the post
         */
        unpinPost: (postId: string) => void;

        /**
         * Function to open a modal
         */
        openModal: <P>(modalData: ModalData<P>) => void;

        /**
         * Function to close a modal
         */
        closeModal: (modalId: string) => void;

        /**
         * Function to set the unread mark at given post
         */
        markPostAsUnread: (post: Post, location?: string) => void;

        /**
         * Function to set the thread as followed/unfollowed
         */
        setThreadFollow: (userId: string, teamId: string, threadId: string, newState: boolean) => void;

        /**
         * Function to burn a BoR post now
         */
        burnPostNow?: (postId: string) => Promise<any>;

        /**
         * Function to save user preferences
         */
        savePreferences: (userId: string, preferences: Array<{category: string; user_id: string; name: string; value: string}>) => void;

    }; // TechDebt: Made non-mandatory while converting to typescript

    canEdit: boolean;
    canDelete: boolean;
    userId: string;
    threadId: UserThread['id'];
    isFollowingThread?: boolean;
    isMentionedInRootPost?: boolean;
    threadReplyCount?: number;
    isChannelAutotranslated: boolean;
    isBurnOnReadPost: boolean;
    isUnrevealedBurnOnReadPost: boolean;
}

type State = {
    canEdit: boolean;
    canDelete: boolean;
}

export class DotMenuClass extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        isFlagged: false,
        isReadOnly: false,
        location: Locations.CENTER,
    };
    private editDisableAction: DelayedAction;

    constructor(props: Props) {
        super(props);

        this.editDisableAction = new DelayedAction(this.handleEditDisable);

        this.state = {
            canEdit: props.canEdit && !props.isReadOnly,
            canDelete: props.canDelete && !props.isReadOnly,
        };
    }

    static getDerivedStateFromProps(props: Props) {
        const state: Partial<State> = {
            canEdit: props.canEdit && !props.isReadOnly,
            canDelete: props.canDelete && !props.isReadOnly,
        };

        return state;
    }

    disableCanEditPostByTime() {
        const {post, isLicensed} = this.props;
        const {canEdit} = this.state;

        const postEditTimeLimit = this.props.postEditTimeLimit || Constants.UNSET_POST_EDIT_TIME_LIMIT;

        if (canEdit && isLicensed) {
            if (postEditTimeLimit !== String(Constants.UNSET_POST_EDIT_TIME_LIMIT)) {
                const milliseconds = 1000;
                const timeLeft = (post.create_at + (Number(postEditTimeLimit) * milliseconds)) - Utils.getTimestamp();
                if (timeLeft > 0) {
                    this.editDisableAction.fireAfter(timeLeft + milliseconds);
                }
            }
        }
    }

    componentDidMount() {
        this.disableCanEditPostByTime();
    }

    componentWillUnmount() {
        this.editDisableAction.cancel();
    }

    handleEditDisable = () => {
        this.setState({canEdit: false});
    };

    handleFlagMenuItemActivated = () => {
        if (this.props.isFlagged) {
            this.props.actions.unflagPost(this.props.post.id);
        } else {
            this.props.actions.flagPost(this.props.post.id);
        }
    };

    handleAddReactionMenuItemActivated = () => {
        if (this.props.handleAddReactionClick) {
            this.props.handleAddReactionClick(true);
        }
    };

    copyLink = () => {
        Utils.copyToClipboard(`${this.props.teamUrl}/pl/${this.props.post.id}`);
    };

    copyText = () => {
        Utils.copyToClipboard(getMessageToCopy(this.props.post, this.props.isChannelAutotranslated, this.props.intl.locale));
    };

    handlePinMenuItemActivated = (): void => {
        if (this.props.post.is_pinned) {
            this.props.actions.unpinPost(this.props.post.id);
        } else {
            this.props.actions.pinPost(this.props.post.id);
        }
    };

    handleMarkPostAsUnread = (): void => {
        this.props.actions.markPostAsUnread(this.props.post, this.props.location);
    };

    handleDeleteMenuItemActivated = (): void => {
        // For BoR posts, use BurnOnReadConfirmationModal instead of DeletePostModal
        if (this.props.isBurnOnReadPost) {
            const isSender = this.props.post.user_id === this.props.userId;

            // Use shared helper to create modal handlers
            const handlers = createBurnOnReadDeleteModalHandlers(
                this.props.actions,
                {
                    postId: this.props.post.id,
                    userId: this.props.userId,
                    isSender,
                },
            );

            const burnOnReadModalData = {
                modalId: ModalIdentifiers.BURN_ON_READ_CONFIRMATION,
                dialogType: BurnOnReadConfirmationModal,
                dialogProps: {
                    show: true,
                    ...handlers,
                },
            };

            this.props.actions.openModal(burnOnReadModalData);
        } else {
            const deletePostModalData = {
                modalId: ModalIdentifiers.DELETE_POST,
                dialogType: DeletePostModal,
                dialogProps: {
                    post: this.props.post,
                    isRHS: this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT,
                },
            };

            this.props.actions.openModal(deletePostModalData);
        }
    };

    handleFlagPostMenuItemClicked = () => {
        const flagPostModalData = {
            modalId: ModalIdentifiers.FLAG_POST,
            dialogType: FlagPostModal,
            dialogProps: {
                postId: this.props.post.id,
                onExited: () => closeModal(ModalIdentifiers.FLAG_POST),
            },
        };

        this.props.actions.openModal(flagPostModalData);
    };

    handleMoveThreadMenuItemActivated = (e: ChangeEvent): void => {
        e.preventDefault();
        if (!this.props.canMove) {
            return;
        }

        const moveThreadModalData = {
            modalId: ModalIdentifiers.MOVE_THREAD_MODAL,
            dialogType: MoveThreadModal,
            dialogProps: {
                post: this.props.post,
            },
        };

        this.props.actions.openModal(moveThreadModalData);
    };

    handleForwardMenuItemActivated = (): void => {
        if (!this.props.canForward) {
            // adding this early return since only hiding the Item from the menu is not enough,
            // since a user can always use the Shortcuts to activate the function as well
            return;
        }

        const forwardPostModalData = {
            modalId: ModalIdentifiers.FORWARD_POST_MODAL,
            dialogType: ForwardPostModal,
            dialogProps: {
                post: this.props.post,
            },
        };

        this.props.actions.openModal(forwardPostModalData);
    };

    handleEditMenuItemActivated = (): void => {
        this.props.handleDropdownOpened?.(false);
        this.props.actions.setEditingPost(
            this.props.post.id,
            this.props.location === Locations.CENTER ? 'post_textbox' : 'reply_textbox',
            this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT || this.props.location === Locations.SEARCH,
        );
    };

    handleSetThreadFollow = () => {
        const {actions, teamId, threadId, userId, isFollowingThread, isMentionedInRootPost} = this.props;
        let followingThread: boolean;

        // This is required as post with mention doesn't have isFollowingThread property set to true but user with mention is following, so we will get null as value kind of hack for this.

        if (isFollowingThread === null) {
            followingThread = !isMentionedInRootPost;
        } else {
            followingThread = !isFollowingThread;
        }
        actions.setThreadFollow(
            userId,
            teamId,
            threadId,
            followingThread,
        );
    };

    handleCommentClick = (e: ChangeEvent) => {
        this.props.handleCommentClick?.(e);
    };

    handleMenuKeydown = (event: React.KeyboardEvent<HTMLDivElement>, forceCloseMenu?: (() => void)) => {
        event.preventDefault();

        if (!forceCloseMenu) {
            return;
        }

        const isShiftKeyPressed = event.shiftKey;

        switch (true) {
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.R):
            if (this.props.canReply) {
                forceCloseMenu();
                this.handleCommentClick(event);
            }
            break;

            // edit post
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.E):
            if (this.state.canEdit) {
                forceCloseMenu();
                this.handleEditMenuItemActivated();
            }
            break;

            // follow thread
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.F) && !isShiftKeyPressed:
            if (this.props.canFollowThread) {
                forceCloseMenu();
                this.handleSetThreadFollow();
            }
            break;

            // forward post
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.F) && isShiftKeyPressed:
            if (this.props.canForward) {
                forceCloseMenu();
                this.handleForwardMenuItemActivated();
            }
            break;

            // copy link
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.K):
            if (this.props.canCopyLink) {
                forceCloseMenu();
                this.copyLink();
            }
            break;

            // copy text
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.C):
            if (this.props.canCopyText) {
                forceCloseMenu();
                this.copyText();
            }
            break;

            // delete post
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.DELETE):
            forceCloseMenu();
            this.handleDeleteMenuItemActivated();
            break;

        // move thread
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.W):
            if (this.props.canMove) {
                forceCloseMenu();
                this.handleMoveThreadMenuItemActivated(event);
            }
            break;

            // pin / unpin
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.P):
            if (this.props.canPin && !this.props.isReadOnly) {
                forceCloseMenu();
                this.handlePinMenuItemActivated();
            }
            break;

            // save / unsave
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.S):
            forceCloseMenu();
            this.handleFlagMenuItemActivated();
            break;

            // mark as unread
        case Keyboard.isKeyPressed(event, Constants.KeyCodes.U):
            forceCloseMenu();
            this.handleMarkPostAsUnread();
            break;
        }
    };

    handleMenuToggle = (open: boolean) => {
        this.props.handleDropdownOpened?.(open);
    };

    handleShowTranslation = async () => {
        // Use dynamic import to avoid circular dependency
        // This breaks the cycle because the import only happens at runtime, not at module load time
        const {default: ShowTranslationModal} = await import('components/show_translation_modal');
        this.props.actions.openModal({
            modalId: ModalIdentifiers.SHOW_TRANSLATION,
            dialogType: ShowTranslationModal,
            dialogProps: {postId: this.props.post.id},
        });
    };

    render(): JSX.Element {
        const {formatMessage} = this.props.intl;
        const isFollowingThread = this.props.isFollowingThread ?? this.props.isMentionedInRootPost;
        const isMobile = this.props.isMobileView;
        const isSystemMessage = PostUtils.isSystemMessage(this.props.post);
        const isBurnOnReadPost = this.props.isBurnOnReadPost;
        const isBurnOnReadPostSender = isBurnOnReadPost && this.props.post.user_id === this.props.userId;

        // Determine if delete should show for BoR posts
        const shouldShowDeleteForBoR = isBurnOnReadPost && (
            isBurnOnReadPostSender || // Sender always sees delete
            !this.props.isUnrevealedBurnOnReadPost // Receiver sees delete only if revealed (not concealed)
        );

        const translation = PostUtils.getPostTranslation(this.props.post, this.props.intl.locale);
        const showTranslation = this.props.isChannelAutotranslated && translation?.state === 'ready' && this.props.post.type === '';

        const forwardPostItemText = (
            <span className={'dot-menu__item-new-badge'}>
                <FormattedMessage
                    id='forward_post_button.label'
                    defaultMessage='Forward'
                />
            </span>
        );

        const unFollowThreadLabel = (
            <FormattedMessage
                id='threading.threadMenu.unfollow'
                defaultMessage='Unfollow thread'
            />);

        const unFollowMessageLabel = (
            <FormattedMessage
                id='threading.threadMenu.unfollowMessage'
                defaultMessage='Unfollow message'
            />);

        const followThreadLabel = (
            <FormattedMessage
                id='threading.threadMenu.follow'
                defaultMessage='Follow thread'
            />);

        const followMessageLabel = (
            <FormattedMessage
                id='threading.threadMenu.followMessage'
                defaultMessage='Follow message'
            />);

        const followPostLabel = () => {
            if (isFollowingThread) {
                return this.props.threadReplyCount ? unFollowThreadLabel : unFollowMessageLabel;
            }
            return this.props.threadReplyCount ? followThreadLabel : followMessageLabel;
        };

        const removeFlag = (
            <FormattedMessage
                id='rhs_root.mobile.unflag'
                defaultMessage='Remove from Saved'
            />
        );

        const saveFlag = (
            <FormattedMessage
                id='rhs_root.mobile.flag'
                defaultMessage='Save Message'
            />
        );

        const pinPost = (
            <FormattedMessage
                id='post_info.pin'
                defaultMessage='Pin to Channel'
            />
        );

        const unPinPost = (
            <FormattedMessage
                id='post_info.unpin'
                defaultMessage='Unpin from Channel'
            />
        );

        const showReply = !isSystemMessage && !isBurnOnReadPost && this.props.location === Locations.CENTER;
        const showForward = this.props.canForward;
        const showReactions = Boolean(isMobile && !isSystemMessage && !this.props.isReadOnly && this.props.enableEmojiPicker);
        const showFollowPost = this.props.canFollowThread;
        const showMarkAsUnread = Boolean(!isSystemMessage && !this.props.channelIsArchived && this.props.location !== Locations.SEARCH);
        const showSave = !isSystemMessage && !this.props.isUnrevealedBurnOnReadPost;
        const showRemind = !isSystemMessage;
        const showPin = Boolean(!isSystemMessage && !this.props.isReadOnly && !isBurnOnReadPost);
        const showMove = Boolean(!isSystemMessage && this.props.canMove);
        const showShowTranslation = !isSystemMessage && showTranslation;
        const showCopyText = !isSystemMessage && !isBurnOnReadPost;
        const showCopyLink = !isSystemMessage && (!isBurnOnReadPost || this.props.post.user_id === this.props.userId);
        const showEdit = this.state.canEdit && !isBurnOnReadPost;
        const showFlagContent = this.props.canFlagContent;

        // Delete button should show if:
        // 1. Non-BoR with delete permission, OR
        // 2. BoR post meeting above criteria
        const showDelete = (!isBurnOnReadPost && this.state.canDelete) || shouldShowDeleteForBoR;

        const firstSectionHasItems = showReply || showForward || showReactions || showFollowPost || showMarkAsUnread || showSave || showRemind || showPin || showMove;
        const secondSectionHasItems = showShowTranslation || showCopyText || showCopyLink;
        const thirdSectionHasItems = showEdit || showDelete || showFlagContent;

        return (
            <Menu.Container
                menuButton={{
                    id: `${this.props.location}_button_${this.props.post.id}`,
                    dataTestId: `PostDotMenu-Button-${this.props.post.id}`,
                    class: classNames('post-menu__item', {
                        'post-menu__item--active': this.props.isMenuOpen,
                    }),
                    'aria-label': formatMessage({id: 'post_info.dot_menu.tooltip.more', defaultMessage: 'More'}).toLowerCase(),
                    children: <DotsHorizontalIcon size={16}/>,
                }}
                menu={{
                    id: `${this.props.location}_dropdown_${this.props.post.id}`,
                    'aria-label': formatMessage({id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options'}),
                    onKeyDown: this.handleMenuKeydown,
                    width: '264px',
                    onToggle: this.handleMenuToggle,
                }}
                menuButtonTooltip={{
                    text: formatMessage({id: 'post_info.dot_menu.tooltip.more', defaultMessage: 'More'}),
                    class: 'hidden-xs',
                }}
            >
                {showReply &&
                    <Menu.Item
                        id={`reply_to_post_${this.props.post.id}`}
                        data-testid={`reply_to_post_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.reply'
                                defaultMessage='Reply'
                            />
                        }
                        leadingElement={<ReplyOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='R'/>}
                        onClick={this.handleCommentClick}
                    />
                }
                {showForward &&
                    <Menu.Item
                        id={`forward_post_${this.props.post.id}`}
                        data-testid={`forward_post_${this.props.post.id}`}
                        labels={forwardPostItemText}
                        isLabelsRowLayout={true}
                        leadingElement={<ArrowRightBoldOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='Shift + F'/>}
                        onClick={this.handleForwardMenuItemActivated}
                    />
                }
                {showReactions &&
                    <ChannelPermissionGate
                        channelId={this.props.post.channel_id}
                        teamId={this.props.teamId}
                        permissions={[Permissions.ADD_REACTION]}
                    >
                        <Menu.Item
                            id={`post_reaction_${this.props.post.id}`}
                            data-testid={`post_reaction_${this.props.post.id}`}
                            labels={
                                <FormattedMessage
                                    id='rhs_root.mobile.add_reaction'
                                    defaultMessage='Add Reaction'
                                />
                            }
                            leadingElement={<EmoticonPlusOutlineIcon size={18}/>}
                            onClick={this.handleAddReactionMenuItemActivated}
                        />
                    </ChannelPermissionGate>
                }
                {showFollowPost &&
                    <Menu.Item
                        id={`follow_post_thread_${this.props.post.id}`}
                        data-testid={`follow_post_thread_${this.props.post.id}`}
                        trailingElements={<ShortcutKey shortcutKey='F'/>}
                        labels={followPostLabel()}
                        leadingElement={
                            isFollowingThread ? (
                                <MessageMinusOutlineIcon size={18}/>
                            ) : (
                                <MessageCheckOutlineIcon size={18}/>
                            )
                        }
                        onClick={this.handleSetThreadFollow}
                    />
                }
                {showMarkAsUnread &&
                    <Menu.Item
                        id={`unread_post_${this.props.post.id}`}
                        data-testid={`unread_post_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.unread'
                                defaultMessage='Mark as Unread'
                            />
                        }
                        leadingElement={<MarkAsUnreadIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='U'/>}
                        onClick={this.handleMarkPostAsUnread}
                    />
                }
                {showSave &&
                    <Menu.Item
                        id={`save_post_${this.props.post.id}`}
                        data-testid={`save_post_${this.props.post.id}`}
                        labels={this.props.isFlagged ? removeFlag : saveFlag}
                        leadingElement={this.props.isFlagged ? <BookmarkIcon size={18}/> : <BookmarkOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='S'/>}
                        onClick={this.handleFlagMenuItemActivated}
                    />
                }
                {showRemind &&
                    <PostReminderSubMenu
                        userId={this.props.userId}
                        post={this.props.post}
                        isMilitaryTime={this.props.isMilitaryTime}
                        timezone={this.props.timezone}
                    />
                }
                {showPin &&
                    <Menu.Item
                        id={`${this.props.post.is_pinned ? 'unpin' : 'pin'}_post_${this.props.post.id}`}
                        data-testid={`pin_post_${this.props.post.id}`}
                        labels={this.props.post.is_pinned ? unPinPost : pinPost}
                        leadingElement={this.props.post.is_pinned ? <PinIcon size={18}/> : <PinOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='P'/>}
                        onClick={this.handlePinMenuItemActivated}
                    />
                }
                {showMove &&
                    <Menu.Item
                        id={`move_thread_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id={'post_info.move_thread'}
                                defaultMessage={'Move Thread'}
                            />}
                        leadingElement={<MessageArrowRightOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='W'/>}
                        onClick={this.handleMoveThreadMenuItemActivated}
                    />
                }
                {firstSectionHasItems && secondSectionHasItems && <Menu.Separator/>}
                {showShowTranslation && (
                    <Menu.Item
                        id={`show_translation_${this.props.post.id}`}
                        data-testid={`show_translation_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.show_translation'
                                defaultMessage='Show translation'
                            />
                        }
                        leadingElement={<TranslateIcon size={18}/>}
                        onClick={this.handleShowTranslation}
                    />
                )}
                {showCopyText &&
                    <Menu.Item
                        id={`copy_${this.props.post.id}`}
                        data-testid={`copy_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.copy'
                                defaultMessage='Copy Text'
                            />}
                        leadingElement={<ContentCopyIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='C'/>}
                        onClick={this.copyText}
                    />
                }
                {showCopyLink &&
                    <Menu.Item
                        id={`permalink_${this.props.post.id}`}
                        data-testid={`permalink_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.permalink'
                                defaultMessage='Copy Link'
                            />}
                        leadingElement={<LinkVariantIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='K'/>}
                        onClick={this.copyLink}
                    />
                }
                {thirdSectionHasItems && (firstSectionHasItems || secondSectionHasItems) && <Menu.Separator/>}
                {showEdit &&
                    <Menu.Item
                        id={`edit_post_${this.props.post.id}`}
                        data-testid={`edit_post_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id='post_info.edit'
                                defaultMessage='Edit'
                            />}
                        leadingElement={<PencilOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='E'/>}
                        onClick={this.handleEditMenuItemActivated}
                    />
                }
                {
                    showFlagContent &&
                    <Menu.Item
                        id={`flag_post_${this.props.post.id}`}
                        className='flag_post_menu_item'
                        data-testid={`flag_post_${this.props.post.id}`}
                        leadingElement={<i className='icon icon-flag-outline'/>}
                        labels={
                            <FormattedMessage
                                id='post_info.flag'
                                defaultMessage='Flag message'
                            />
                        }
                        onClick={this.handleFlagPostMenuItemClicked}
                        isDestructive={true}
                    />
                }
                {showDelete &&
                    <Menu.Item
                        id={`delete_post_${this.props.post.id}`}
                        data-testid={`delete_post_${this.props.post.id}`}
                        leadingElement={<TrashCanOutlineIcon size={18}/>}
                        trailingElements={<span>{'delete'}</span>}
                        labels={
                            <FormattedMessage
                                id='post_info.del'
                                defaultMessage='Delete'
                            />}
                        onClick={this.handleDeleteMenuItemActivated}
                        isDestructive={true}
                    />
                }
            </Menu.Container>
        );
    }
}

export default injectIntl(DotMenuClass);
