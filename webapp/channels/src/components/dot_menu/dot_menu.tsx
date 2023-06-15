// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime, injectIntl, IntlShape} from 'react-intl';
import classNames from 'classnames';

import {UserThread} from '@mattermost/types/threads';
import {Post} from '@mattermost/types/posts';

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
    ChevronRightIcon, 
    ClockOutlineIcon
} from '@mattermost/compass-icons/components';

import {ModalData} from 'types/actions';
import {getCurrentMomentForTimezone} from 'utils/timezone';
import {Locations, ModalIdentifiers, Constants, TELEMETRY_LABELS} from 'utils/constants';
import DelayedAction from 'utils/delayed_action';
import * as Keyboard from 'utils/keyboard';
import {toUTCUnix} from 'utils/datetime';
import * as PostUtils from 'utils/post_utils';
import * as Utils from 'utils/utils';

import PostReminderCustomTimePicker from 'components/post_reminder_custom_time_picker_modal';
import DeletePostModal from 'components/delete_post_modal';
import * as Menu from 'components/menu';

import ForwardPostModal from '../forward_post_modal';
import {ChangeEvent, trackDotMenuEvent} from './utils';
import './dot_menu.scss';

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
    canAddReaction: boolean;

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
        addPostReminder: (userId: string, postId: string, timestamp: number) => void;
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

const PostReminders = {
    THIRTY_MINUTES: 'thirty_minutes',
    ONE_HOUR: 'one_hour',
    TWO_HOURS: 'two_hours',
    TOMORROW: 'tomorrow',
    CUSTOM: 'custom',
} as const;

export class DotMenuClass extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        isFlagged: false,
        isReadOnly: false,
        location: Locations.CENTER,
    };
    private editDisableAction: DelayedAction;
    private canPostBeForwarded: boolean;

    constructor(props: Props) {
        super(props);

        this.editDisableAction = new DelayedAction(this.handleEditDisable);

        this.state = {
            closeMenuManually: false,
            canEdit: props.canEdit && !props.isReadOnly,
            canDelete: props.canDelete && !props.isReadOnly,
        };

        this.canPostBeForwarded = false;
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

    handleFlagMenuItemActivated = (e: ChangeEvent) => {
        if (this.props.isFlagged) {
            this.props.actions.unflagPost(this.props.post.id);
            trackDotMenuEvent(e, TELEMETRY_LABELS.UNSAVE);
        } else {
            this.props.actions.flagPost(this.props.post.id);
            trackDotMenuEvent(e, TELEMETRY_LABELS.SAVE);
        }
    };

    handleAddReactionMenuItemActivated = () => {
        // to be safe, make sure the handler function has been defined
        if (this.props.handleAddReactionClick) {
            this.props.handleAddReactionClick();
        }
    };

    copyLink = (e: ChangeEvent) => {
        Utils.copyToClipboard(`${this.props.teamUrl}/pl/${this.props.post.id}`);
        trackDotMenuEvent(e, TELEMETRY_LABELS.COPY_LINK);
    };

    copyText = (e: ChangeEvent) => {
        Utils.copyToClipboard(this.props.post.message);
        trackDotMenuEvent(e, TELEMETRY_LABELS.COPY_TEXT);
    };

    handlePinMenuItemActivated = (e: ChangeEvent): void => {
        if (this.props.post.is_pinned) {
            this.props.actions.unpinPost(this.props.post.id);
            trackDotMenuEvent(e, TELEMETRY_LABELS.UNPIN);
        } else {
            this.props.actions.pinPost(this.props.post.id);
            trackDotMenuEvent(e, TELEMETRY_LABELS.PIN);
        }
    };

    handleMarkPostAsUnread = (e: ChangeEvent): void => {
        this.props.actions.markPostAsUnread(this.props.post, this.props.location);
        trackDotMenuEvent(e, TELEMETRY_LABELS.UNREAD);
    };

    handleDeleteMenuItemActivated = (e: ChangeEvent): void => {
        const deletePostModalData = {
            modalId: ModalIdentifiers.DELETE_POST,
            dialogType: DeletePostModal,
            dialogProps: {
                post: this.props.post,
                isRHS: this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT,
            },
        };

        this.props.actions.openModal(deletePostModalData);

        trackDotMenuEvent(e, TELEMETRY_LABELS.DELETE);
    };

    handleForwardMenuItemActivated = (e: ChangeEvent): void => {
        if (!this.canPostBeForwarded) {
            // adding this early return since only hiding the Item from the menu is not enough,
            // since a user can always use the Shortcuts to activate the function as well
            return;
        }

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
        this.props.handleDropdownOpened?.(false);
        this.props.actions.setEditingPost(
            this.props.post.id,
            this.props.location === Locations.CENTER ? 'post_textbox' : 'reply_textbox',
            this.props.post.root_id ? Utils.localizeMessage('rhs_comment.comment', 'Comment') : Utils.localizeMessage('create_post.post', 'Post'),
            this.props.location === Locations.RHS_ROOT || this.props.location === Locations.RHS_COMMENT || this.props.location === Locations.SEARCH,
        );
        trackDotMenuEvent(e, TELEMETRY_LABELS.EDIT);
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

    onShortcutKeyDown = (e: React.KeyboardEvent): void => {
        e.preventDefault();

        // Check if the event is a keyboard event and not a mouse click event
        if (e.getModifierState === undefined) {
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

    handlePostReminderMenuClick = (id: string): void => {
        if (id === PostReminders.CUSTOM) {
            const postReminderCustomTimePicker = {
                modalId: ModalIdentifiers.POST_REMINDER_CUSTOM_TIME_PICKER,
                dialogType: PostReminderCustomTimePicker,
                dialogProps: {
                    postId: this.props.post.id,
                },
            };

            this.props.actions.openModal(postReminderCustomTimePicker);
        } else {
            const currentDate = getCurrentMomentForTimezone(
                this.props.timezone
            );

            let endTime = currentDate;
            if (id === PostReminders.THIRTY_MINUTES) {
                // add 30 minutes in current time
                endTime = currentDate.add(30, "minutes");
            } else if (id === PostReminders.ONE_HOUR) {
                // add 1 hour in current time
                endTime = currentDate.add(1, "hour");
            } else if (id === PostReminders.TWO_HOURS) {
                // add 2 hours in current time
                endTime = currentDate.add(2, "hours");
            } else if (id === PostReminders.TOMORROW) {
                // add one day in current date
                endTime = currentDate.add(1, "day");
            }

            this.props.actions.addPostReminder(this.props.userId, this.props.post.id, toUTCUnix(endTime.toDate()));
        }
    };

    renderPostReminderMenuItems = (timezone: Props['timezone'], isMilitaryTime: Props['isMilitaryTime'], postId: Props['post']['id']) => {
        return Object.values(PostReminders).map((postReminder) => {
            let labels = null;
            if (postReminder === PostReminders.THIRTY_MINUTES) {
                labels = (
                    <FormattedMessage
                        id="post_info.post_reminder.sub_menu.thirty_minutes"
                        defaultMessage="30 mins"
                    />
                )
            } else if (postReminder === PostReminders.ONE_HOUR) {
                labels = (
                    <FormattedMessage
                        id="post_info.post_reminder.sub_menu.one_hour"
                        defaultMessage="1 hour"
                    />
                )
            } else if (postReminder === PostReminders.TWO_HOURS) {
                labels = (
                    <FormattedMessage
                        id="post_info.post_reminder.sub_menu.two_hours"
                        defaultMessage="2 hours"
                    />
                )
            } else if (postReminder === PostReminders.TOMORROW) {
                labels = (
                    <FormattedMessage
                        id="post_info.post_reminder.sub_menu.tomorrow"
                        defaultMessage="Tomorrow"
                    />
                )
            } else {
                labels = (
                    <FormattedMessage
                        id="post_info.post_reminder.sub_menu.custom"
                        defaultMessage="Custom"
                    />
                )
            }

            let trailingElements = null;
            if (postReminder === PostReminders.TOMORROW) {
                const tomorrow = getCurrentMomentForTimezone(timezone)
                    .add(1, "day")
                    .toDate();

                trailingElements = (
                    <span className={`postReminder-${postReminder}_timestamp`}>
                        <FormattedDate
                            value={tomorrow}
                            weekday="short"
                            timeZone={timezone}
                        />
                        {", "}
                        <FormattedTime
                            value={tomorrow}
                            timeStyle="short"
                            hour12={!isMilitaryTime}
                            timeZone={timezone}
                        />
                    </span>
                );
            }

            return (
                <Menu.Item
                    id={Menu.createMenuItemId("remind_post_options",postReminder, postId)}
                    key={Menu.createMenuItemId("remind_post_options",postReminder, postId)}
                    labels={labels}
                    trailingElements={trailingElements}
                    onClick={() => this.handlePostReminderMenuClick(postReminder)}
                />
            );
        });
    };

    render(): JSX.Element {
        const {formatMessage} = this.props.intl;
        const isFollowingThread = this.props.isFollowingThread ?? this.props.isMentionedInRootPost;
        const isMobile = this.props.isMobileView;
        const isSystemMessage = PostUtils.isSystemMessage(this.props.post);

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
                        id={Menu.createMenuItemId('reply', this.props.post.id)}
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
                        id={Menu.createMenuItemId('forward', this.props.post.id)}
                        data-testid={`forward_post_${this.props.post.id}`}
                        labels={forwardPostItemText}
                        isLabelsRowLayout={true}
                        leadingElement={<ArrowRightBoldOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='Shift + F'/>}
                        onClick={this.handleForwardMenuItemActivated}
                    />
                }
                {Boolean(isMobile && !isSystemMessage && !this.props.isReadOnly && this.props.enableEmojiPicker && this.props.canAddReaction) &&
                    <Menu.Item
                        id={Menu.createMenuItemId('reaction', this.props.post.id)}
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
                {Boolean(
                    !isSystemMessage &&
                        this.props.isCollapsedThreadsEnabled &&
                        (this.props.location === Locations.CENTER ||
                            this.props.location === Locations.RHS_ROOT ||
                            this.props.location === Locations.RHS_COMMENT)) &&
                    <Menu.Item
                        id={Menu.createMenuItemId('follow', this.props.post.id)}
                        data-testid={`follow_post_thread_${this.props.post.id}`}
                        trailingElements={<ShortcutKey shortcutKey="F" />}
                        labels={followPostLabel()}
                        leadingElement={
                            isFollowingThread ? (
                                <MessageMinusOutlineIcon size={18} />
                            ) : (
                                <MessageCheckOutlineIcon size={18} />
                            )
                        }
                        onClick={this.handleSetThreadFollow}
                    />
                }
                {Boolean(!isSystemMessage && !this.props.channelIsArchived && this.props.location !== Locations.SEARCH) &&
                    <Menu.Item
                        id={Menu.createMenuItemId('unread', this.props.post.id)}
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
                    <Menu.SubMenu
                        id={Menu.createSubMenuId('remind_post', this.props.post.id)}
                        labels={
                            <FormattedMessage
                                id='post_info.post_reminder.menu'
                                defaultMessage='Remind'
                            />
                        }
                        leadingElement={<ClockOutlineIcon size={18}/>}
                        trailingElements={<span className={'dot-menu__item-trailing-icon'}><ChevronRightIcon size={16}/></span>}
                        menuId={`remind_post_${this.props.post.id}-menu`}
                    >
                        <h5 className={'dot-menu__post-reminder-menu-header'}>
                            {formatMessage(
                                {id: 'post_info.post_reminder.sub_menu.header',
                                    defaultMessage: 'Set a reminder for:'},
                            )}
                        </h5>
                        {this.renderPostReminderMenuItems(this.props.timezone, this.props.isMilitaryTime, this.props.post.id)}
                    </Menu.SubMenu>
                }
                {!isSystemMessage &&
                    <Menu.Item
                        id={Menu.createMenuItemId('save', this.props.post.id)}
                        data-testid={`save_post_${this.props.post.id}`}
                        labels={this.props.isFlagged ? removeFlag : saveFlag}
                        leadingElement={this.props.isFlagged ? <BookmarkIcon size={18}/> : <BookmarkOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='S'/>}
                        onClick={this.handleFlagMenuItemActivated}
                    />
                }
                {Boolean(!isSystemMessage && !this.props.isReadOnly) &&
                    <Menu.Item
                        id={Menu.createMenuItemId('pinUnpin', this.props.post.id)}
                        data-testid={`pin_post_${this.props.post.id}`}
                        labels={this.props.post.is_pinned ? unPinPost : pinPost}
                        leadingElement={this.props.post.is_pinned ? <PinIcon size={18}/> : <PinOutlineIcon size={18}/>}
                        trailingElements={<ShortcutKey shortcutKey='P'/>}
                        onClick={this.handlePinMenuItemActivated}
                    />
                }
                {!isSystemMessage && (this.state.canEdit || this.state.canDelete) && <Menu.Separator/>}
                {!isSystemMessage &&
                    <Menu.Item
                        id={Menu.createMenuItemId('copyLink', this.props.post.id)}
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
                        id={Menu.createMenuItemId('edit', this.props.post.id)}
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
                        id={Menu.createMenuItemId('copyText', this.props.post.id)}
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
                        id={Menu.createMenuItemId('delete', this.props.post.id)}
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
