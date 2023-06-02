// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';
import classNames from 'classnames';

import {
    ArrowRightBoldOutlineIcon,
    BookmarkIcon,
    BookmarkOutlineIcon,
    ContentCopyIcon,
    DotsHorizontalIcon,
    EmoticonPlusOutlineIcon,
    LinkVariantIcon,
    MarkAsUnreadIcon,
    MessageCheckOutlineIcon,
    MessageMinusOutlineIcon,
    PencilOutlineIcon,
    PinIcon,
    PinOutlineIcon,
    ReplyOutlineIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';

import Permissions from 'mattermost-redux/constants/permissions';

import {Locations, ModalIdentifiers, Constants, TELEMETRY_LABELS, Preferences} from 'utils/constants';
import DeletePostModal from 'components/delete_post_modal';
import DelayedAction from 'utils/delayed_action';
import * as Keyboard from 'utils/keyboard';
import * as PostUtils from 'utils/post_utils';
import * as Menu from 'components/menu';
import * as Utils from 'utils/utils';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import {ModalData} from 'types/actions';

import {UserThread} from '@mattermost/types/threads';
import {Post} from '@mattermost/types/posts';
import ForwardPostModal from '../forward_post_modal';
import MoveThreadModal from '../move_thread_modal';

import {ChangeEvent, trackDotMenuEvent} from './utils';

import './dot_menu.scss';
import {PostReminderSubmenu} from './post_reminder_submenu';

type ShortcutKeyProps = {
    shortcutKey: string;
};

const ShortcutKey = ({shortcutKey: shortcut}: ShortcutKeyProps) => (
    <span>
        {shortcut}
    </span>
);

type Props = {
    intl: IntlShape;
    post: Post;
    teamId: string;
    location?: 'CENTER' | 'RHS_ROOT' | 'RHS_COMMENT' | 'SEARCH' | string;
    isFlagged?: boolean;
    handleCommentClick?: React.EventHandler<any>;
    handleDropdownOpened: (open: boolean) => void;
    handleAddReactionClick?: () => void;
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
        setEditingPost: (postId?: string, refocusId?: string, title?: string, isRHS?: boolean) => void;

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
         * Function to set the unread mark at given post
         */
        markPostAsUnread: (post: Post, location?: 'CENTER' | 'RHS_ROOT' | 'RHS_COMMENT' | string) => void;

        /**
         * Function to set the thread as followed/unfollowed
         */
        setThreadFollow: (userId: string, teamId: string, threadId: string, newState: boolean) => void;

        /**
         * Function to set a global storage item on the store
         */
        setGlobalItem: (name: string, value: any) => void;

    }; // TechDebt: Made non-mandatory while converting to typescript

    canEdit: boolean;
    canDelete: boolean;
    userId: string;
    threadId: UserThread['id'];
    isCollapsedThreadsEnabled: boolean;
    isFollowingThread?: boolean;
    isMentionedInRootPost?: boolean;
    threadReplyCount?: number;
}

type State = {
    closeMenuManually: boolean;
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
    private buttonRef: React.RefObject<HTMLButtonElement>;
    private canPostBeForwarded: boolean;

    constructor(props: Props) {
        super(props);

        this.editDisableAction = new DelayedAction(this.handleEditDisable);

        this.state = {
            closeMenuManually: false,
            canEdit: props.canEdit && !props.isReadOnly,
            canDelete: props.canDelete && !props.isReadOnly,
        };

        this.buttonRef = React.createRef<HTMLButtonElement>();

        this.canPostBeForwarded = false;
    }

    static getDerivedStateFromProps(props: Props) {
        const state: Partial<State> = {
            canEdit: props.canEdit && !props.isReadOnly,
            canDelete: props.canDelete && !props.isReadOnly,
        };
        return state;
    }

    disableCanEditPostByTime(): void {
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

    componentDidMount(): void {
        this.disableCanEditPostByTime();
    }

    componentWillUnmount(): void {
        this.editDisableAction.cancel();
    }

    handleEditDisable = (): void => {
        this.setState({canEdit: false});
    };

    handleFlagMenuItemActivated = (e: ChangeEvent): void => {
        if (this.props.isFlagged) {
            trackDotMenuEvent(e, TELEMETRY_LABELS.UNSAVE);
            this.props.actions.unflagPost(this.props.post.id);
        } else {
            trackDotMenuEvent(e, TELEMETRY_LABELS.SAVE);
            this.props.actions.flagPost(this.props.post.id);
        }
    };

    // listen to clicks/taps on add reaction menu item and pass to parent handler
    handleAddReactionMenuItemActivated = (e: ChangeEvent): void => {
        e.preventDefault();

        // to be safe, make sure the handler function has been defined
        if (this.props.handleAddReactionClick) {
            this.props.handleAddReactionClick();
        }
    };

    copyLink = (e: ChangeEvent) => {
        trackDotMenuEvent(e, TELEMETRY_LABELS.COPY_LINK);
        Utils.copyToClipboard(`${this.props.teamUrl}/pl/${this.props.post.id}`);
    };

    copyText = (e: ChangeEvent) => {
        trackDotMenuEvent(e, TELEMETRY_LABELS.COPY_TEXT);
        Utils.copyToClipboard(this.props.post.message);
    };

    handlePinMenuItemActivated = (e: ChangeEvent): void => {
        if (this.props.post.is_pinned) {
            trackDotMenuEvent(e, TELEMETRY_LABELS.UNPIN);
            this.props.actions.unpinPost(this.props.post.id);
        } else {
            trackDotMenuEvent(e, TELEMETRY_LABELS.PIN);
            this.props.actions.pinPost(this.props.post.id);
        }
    };

    handleMarkPostAsUnread = (e: ChangeEvent): void => {
        e.preventDefault();
        trackDotMenuEvent(e, TELEMETRY_LABELS.UNREAD);
        this.props.actions.markPostAsUnread(this.props.post, this.props.location);
    };

    handleDeleteMenuItemActivated = (e: ChangeEvent): void => {
        e.preventDefault();

        trackDotMenuEvent(e, TELEMETRY_LABELS.DELETE);
        const deletePostModalData = {
            modalId: ModalIdentifiers.DELETE_POST,
            dialogType: DeletePostModal,
            dialogProps: {
                post: this.props.post,
                isRHS: this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT,
            },
        };

        this.props.actions.openModal(deletePostModalData);
    };

    handleMoveThreadMenuItemActivated = (e: ChangeEvent): void => {
        e.preventDefault();
        if (!this.props.canMove) {
            return;
        }

        trackDotMenuEvent(e, TELEMETRY_LABELS.MOVE_THREAD);
        const moveThreadModalData = {
            modalId: ModalIdentifiers.MOVE_THREAD_MODAL,
            dialogType: MoveThreadModal,
            dialogProps: {
                post: this.props.post,
            },
        };

        this.props.actions.setGlobalItem(Preferences.FORWARD_POST_VIEWED, false);
        this.props.actions.openModal(moveThreadModalData);
    };

    handleForwardMenuItemActivated = (e: ChangeEvent): void => {
        if (!this.canPostBeForwarded) {
            // adding this early return since only hiding the Item from the menu is not enough,
            // since a user can always use the Shortcuts to activate the function as well
            return;
        }

        e.preventDefault();

        trackDotMenuEvent(e, TELEMETRY_LABELS.FORWARD);
        const forwardPostModalData = {
            modalId: ModalIdentifiers.FORWARD_POST_MODAL,
            dialogType: ForwardPostModal,
            dialogProps: {
                post: this.props.post,
            },
        };

        this.props.actions.openModal(forwardPostModalData);
    };

    handleEditMenuItemActivated = (e: ChangeEvent): void => {
        trackDotMenuEvent(e, TELEMETRY_LABELS.EDIT);
        this.props.handleDropdownOpened?.(false);
        this.props.actions.setEditingPost(
            this.props.post.id,
            this.props.location === Locations.CENTER ? 'post_textbox' : 'reply_textbox',
            this.props.post.root_id ? Utils.localizeMessage('rhs_comment.comment', 'Comment') : Utils.localizeMessage('create_post.post', 'Post'),
            this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT || this.props.location === Locations.SEARCH,
        );
    };

    handleSetThreadFollow = (e: ChangeEvent) => {
        const {actions, teamId, threadId, userId, isFollowingThread, isMentionedInRootPost} = this.props;
        let followingThread: boolean;

        // This is required as post with mention doesn't have isFollowingThread property set to true but user with mention is following, so we will get null as value kind of hack for this.

        if (isFollowingThread === null) {
            followingThread = !isMentionedInRootPost;
        } else {
            followingThread = !isFollowingThread;
        }
        if (followingThread) {
            trackDotMenuEvent(e, TELEMETRY_LABELS.FOLLOW);
        } else {
            trackDotMenuEvent(e, TELEMETRY_LABELS.UNFOLLOW);
        }
        actions.setThreadFollow(
            userId,
            teamId,
            threadId,
            followingThread,
        );
    };

    handleCommentClick = (e: ChangeEvent) => {
        trackDotMenuEvent(e, TELEMETRY_LABELS.REPLY);
        this.props.handleCommentClick?.(e);
    };

    isKeyboardEvent = (e: React.KeyboardEvent): any => {
        return (e).getModifierState !== undefined;
    };

    onShortcutKeyDown = (e: React.KeyboardEvent): void => {
        e.preventDefault();
        if (!this.isKeyboardEvent(e)) {
            return;
        }

        const isShiftKeyPressed = e.shiftKey;

        switch (true) {
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.R):
            this.handleCommentClick(e);
            this.handleDropdownOpened(false);
            break;

            // edit post
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.E):
            this.handleEditMenuItemActivated(e);
            this.handleDropdownOpened(false);
            break;

            // follow thread
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.F) && !isShiftKeyPressed:
            this.handleSetThreadFollow(e);
            this.handleDropdownOpened(false);
            break;

            // forward post
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.F) && isShiftKeyPressed:
            this.handleForwardMenuItemActivated(e);
            this.handleDropdownOpened(false);
            break;

            // copy link
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.K):
            this.copyLink(e);
            this.handleDropdownOpened(false);
            break;

            // copy text
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.C):
            this.copyText(e);
            this.handleDropdownOpened(false);
            break;

            // delete post
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.DELETE):
            this.handleDeleteMenuItemActivated(e);
            this.handleDropdownOpened(false);
            break;

        // move thread
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.W):
            this.handleMoveThreadMenuItemActivated(e);
            this.props.handleDropdownOpened(false);
            break;

            // pin / unpin
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.P):
            this.handlePinMenuItemActivated(e);
            this.handleDropdownOpened(false);
            break;

            // save / unsave
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.S):
            this.handleFlagMenuItemActivated(e);
            this.handleDropdownOpened(false);
            break;

            // mark as unread
        case Keyboard.isKeyPressed(e, Constants.KeyCodes.U):
            this.handleMarkPostAsUnread(e);
            this.handleDropdownOpened(false);
            break;
        }
    };

    handleDropdownOpened = (open: boolean) => {
        this.props.handleDropdownOpened?.(open);
        this.setState({closeMenuManually: true});
    };

    handleMenuToggle = (open: boolean) => {
        this.props.handleDropdownOpened?.(open);
        this.setState({closeMenuManually: false});
    };

    render(): JSX.Element {
        const {formatMessage} = this.props.intl;
        const isFollowingThread = this.props.isFollowingThread ?? this.props.isMentionedInRootPost;
        const isMobile = this.props.isMobileView;
        const isSystemMessage = PostUtils.isSystemMessage(this.props.post);
        const deleteShortcutText = (
            <span>
                {'delete'}
            </span>
        );

        this.canPostBeForwarded = !(isSystemMessage);

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
                defaultMessage='Save'
            />
        );

        const pinPost = (
            <FormattedMessage
                id='post_info.pin'
                defaultMessage='Pin'
            />
        );
        const unPinPost = (
            <FormattedMessage
                id='post_info.unpin'
                defaultMessage='Unpin'
            />
        );

        return (
            <Menu.Container
                menuButton={{
                    id: `${this.props.location}_button_${this.props.post.id}`,
                    dateTestId: `PostDotMenu-Button-${this.props.post.id}`,
                    class: classNames('post-menu__item', {
                        'post-menu__item--active': this.props.isMenuOpen,
                    }),
                    'aria-label': formatMessage({id: 'post_info.dot_menu.tooltip.more', defaultMessage: 'More'}).toLowerCase(),
                    children: <DotsHorizontalIcon size={16}/>,
                }}
                menu={{
                    id: `${this.props.location}_dropdown_${this.props.post.id}`,
                    'aria-label': formatMessage({id: 'post_info.menuAriaLabel', defaultMessage: 'Post extra options'}),
                    onKeyDown: this.onShortcutKeyDown,
                    width: '264px',
                    onToggle: this.handleMenuToggle,
                    closeMenuManually: this.state.closeMenuManually,
                }}
                menuButtonTooltip={{
                    id: `PostDotMenu-ButtonTooltip-${this.props.post.id}`,
                    text: formatMessage({id: 'post_info.dot_menu.tooltip.more', defaultMessage: 'More'}),
                    class: 'hidden-xs',
                }}
            >
                {!isSystemMessage && this.props.location === Locations.CENTER &&
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
                {this.canPostBeForwarded &&
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
                <ChannelPermissionGate
                    channelId={this.props.post.channel_id}
                    teamId={this.props.teamId}
                    permissions={[Permissions.ADD_REACTION]}
                >
                    {Boolean(isMobile && !isSystemMessage && !this.props.isReadOnly && this.props.enableEmojiPicker) &&
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
                    }
                </ChannelPermissionGate>
                {Boolean(
                    !isSystemMessage &&
                        this.props.isCollapsedThreadsEnabled &&
                        (
                            this.props.location === Locations.CENTER ||
                            this.props.location === Locations.RHS_ROOT ||
                            this.props.location === Locations.RHS_COMMENT
                        ),
                ) &&
                    <Menu.Item
                        id={`follow_post_thread_${this.props.post.id}`}
                        data-testid={`follow_post_thread_${this.props.post.id}`}
                        trailingElements={<ShortcutKey shortcutKey='F'/>}
                        labels={followPostLabel()}
                        leadingElement={isFollowingThread ? <MessageMinusOutlineIcon size={18}/> : <MessageCheckOutlineIcon size={18}/>}
                        onClick={this.handleSetThreadFollow}
                    />
                }
                {Boolean(!isSystemMessage && !this.props.channelIsArchived && this.props.location !== Locations.SEARCH) &&
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
                {!isSystemMessage &&
                    <PostReminderSubmenu
                        userId={this.props.userId}
                        post={this.props.post}
                        isMilitaryTime={this.props.isMilitaryTime}
                        timezone={this.props.timezone}
                    />
                }
                {!isSystemMessage &&
                    <Menu.Item
                        id={`save_post_${this.props.post.id}`}
                        data-testid={`save_post_${this.props.post.id}`}
                        labels={this.props.isFlagged ? removeFlag : saveFlag}
                        leadingElement={this.props.isFlagged ? <BookmarkIcon size={18}/> : <BookmarkOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='S'/>}
                        onClick={this.handleFlagMenuItemActivated}
                    />
                }
                {Boolean(!isSystemMessage && !this.props.isReadOnly) &&
                    <Menu.Item
                        id={`${this.props.post.is_pinned ? 'unpin' : 'pin'}_post_${this.props.post.id}`}
                        data-testid={`pin_post_${this.props.post.id}`}
                        labels={this.props.post.is_pinned ? unPinPost : pinPost}
                        leadingElement={this.props.post.is_pinned ? <PinIcon size={18}/> : <PinOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='P'/>}
                        onClick={this.handlePinMenuItemActivated}
                    />
                }
                {Boolean(!isSystemMessage && this.props.canMove) &&
                    <Menu.Item
                        id={`move_thread_${this.props.post.id}`}
                        labels={
                            <FormattedMessage
                                id={'post_info.move_thread'}
                                defaultMessage={'Move Thread'}
                            />}
                        leadingElement={Utils.getMenuItemIcon('icon-message-arrow-right-outline')}
                        trailingElements={<ShortcutKey shortcutKey='W'/>}
                        onClick={this.handleMoveThreadMenuItemActivated}
                    />
                }
                {!isSystemMessage && (this.state.canEdit || this.state.canDelete) && <Menu.Separator/>}
                {!isSystemMessage &&
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
                {!isSystemMessage && <Menu.Separator/>}
                {this.state.canEdit &&
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
                {!isSystemMessage &&
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
                {this.state.canDelete &&
                    <Menu.Item
                        id={`delete_post_${this.props.post.id}`}
                        data-testid={`delete_post_${this.props.post.id}`}
                        leadingElement={<TrashCanOutlineIcon size={18}/>}
                        trailingElements={deleteShortcutText}
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
