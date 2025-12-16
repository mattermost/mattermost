// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Posts} from 'mattermost-redux/constants/index';
import {
    isMeMessage as checkIsMeMessage,
    isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import BurnOnReadConfirmationModal from 'components/burn_on_read_confirmation_modal';
import AutoHeightSwitcher, {AutoHeightSlots} from 'components/common/auto_height_switcher';
import EditPost from 'components/edit_post';
import FileAttachmentListContainer from 'components/file_attachment_list';
import MessageWithAdditionalContent from 'components/message_with_additional_content';
import PriorityLabel from 'components/post_priority/post_priority_label';
import PostProfilePicture from 'components/post_profile_picture';
import PostAcknowledgements from 'components/post_view/acknowledgements';
import AiGeneratedIndicator from 'components/post_view/ai_generated_indicator/ai_generated_indicator';
import BurnOnReadBadge from 'components/post_view/burn_on_read_badge';
import BurnOnReadConcealedPlaceholder from 'components/post_view/burn_on_read_concealed_placeholder';
import BurnOnReadTimerChip from 'components/post_view/burn_on_read_timer_chip';
import CommentedOn from 'components/post_view/commented_on/commented_on';
import FailedPostOptions from 'components/post_view/failed_post_options';
import PostAriaLabelDiv from 'components/post_view/post_aria_label_div';
import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content';
import PostMessageContainer from 'components/post_view/post_message_view';
import PostPreHeader from 'components/post_view/post_pre_header';
import PostTime from 'components/post_view/post_time';
import ReactionList from 'components/post_view/reaction_list';
import ThreadFooter from 'components/threading/channel_threads/thread_footer';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import InfoSmallIcon from 'components/widgets/icons/info_small_icon';
import WithTooltip from 'components/with_tooltip';

import {createBurnOnReadDeleteModalHandlers} from 'hooks/useBurnOnReadDeleteModal';
import {getHistory} from 'utils/browser_history';
import Constants, {A11yCustomEventTypes, AppEvents, Locations, PostTypes, ModalIdentifiers} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import * as PostUtils from 'utils/post_utils';
import {makeIsEligibleForClick} from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {PostActionComponent, PostPluginComponent} from 'types/store/plugins';

import {withPostErrorBoundary} from './post_error_boundary';
import PostOptions from './post_options';
import PostUserProfile from './user_profile';

export type Props = {
    post: Post;
    currentTeam?: Team;
    team?: Team;
    currentUserId: string;
    compactDisplay?: boolean;
    colorizeUsernames?: boolean;
    isFlagged: boolean;
    previewCollapsed?: string;
    previewEnabled?: boolean;
    isEmbedVisible?: boolean;
    enableEmojiPicker?: boolean;
    enablePostUsernameOverride?: boolean;
    isReadOnly?: boolean;
    pluginPostTypes?: {[postType: string]: PostPluginComponent};
    channelIsArchived?: boolean;
    channelIsShared?: boolean;
    isConsecutivePost?: boolean;
    isLastPost?: boolean;
    recentEmojis: Emoji[];
    center: boolean;
    handleCardClick?: (post: Post) => void;
    togglePostMenu?: (opened: boolean) => void;
    channelName?: string;
    displayName: string;
    teamDisplayName?: string;
    teamName?: string;
    channelType?: string;
    a11yIndex?: number;
    isBot: boolean;
    hasReplies: boolean;
    isFirstReply?: boolean;
    previousPostIsComment?: boolean;
    matches?: string[];
    term?: string;
    isMentionSearch?: boolean;
    location: keyof typeof Locations;
    actions: {
        markPostAsUnread: (post: Post, location: string) => void;
        emitShortcutReactToLastPostFrom: (emittedFrom: 'CENTER' | 'RHS_ROOT' | 'NO_WHERE') => void;
        selectPost: (post: Post) => void;
        selectPostFromRightHandSideSearch: (post: Post) => void;
        removePost: (post: Post) => void;
        closeRightHandSide: () => void;
        selectPostCard: (post: Post) => void;
        setRhsExpanded: (rhsExpanded: boolean) => void;
        revealBurnOnReadPost: (postId: string) => Promise<{data?: any; error?: any}>;
        burnPostNow?: (postId: string) => Promise<any>;
        savePreferences: (userId: string, preferences: Array<{category: string; user_id: string; name: string; value: string}>) => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        closeModal: (modalId: string) => void;
    };
    timestampProps?: Partial<TimestampProps>;
    shouldHighlight?: boolean;
    isPostBeingEdited?: boolean;
    isCollapsedThreadsEnabled?: boolean;
    isMobileView: boolean;
    canReply?: boolean;
    replyCount?: number;
    isFlaggedPosts?: boolean;
    isPinnedPosts?: boolean;
    clickToReply?: boolean;
    isCommentMention?: boolean;
    parentPost?: Post;
    parentPostUser?: UserProfile | null;
    shortcutReactToLastPostEmittedFrom?: string;
    isPostAcknowledgementsEnabled: boolean;
    isPostPriorityEnabled: boolean;
    isCardOpen?: boolean;
    canDelete?: boolean;
    pluginActions: PostActionComponent[];
    shouldDisplayBurnOnReadConcealed?: boolean;
    burnOnReadDurationMinutes: number;
    burnOnReadSkipConfirmation?: boolean;
};

function PostComponent(props: Props) {
    const {post, shouldHighlight, togglePostMenu} = props;
    const {formatMessage} = useIntl();

    const isSearchResultItem = (props.matches && props.matches.length > 0) || props.isMentionSearch || (props.term && props.term.length > 0);
    const isRHS = props.location === Locations.RHS_ROOT || props.location === Locations.RHS_COMMENT || props.location === Locations.SEARCH;
    const postRef = useRef<HTMLDivElement>(null);
    const postHeaderRef = useRef<HTMLDivElement>(null);
    const teamId = props.team?.id ?? props.currentTeam?.id ?? '';

    const [hover, setHover] = useState(false);
    const [a11yActive, setA11y] = useState(false);
    const [dropdownOpened, setDropdownOpened] = useState(false);
    const [fileDropdownOpened, setFileDropdownOpened] = useState(false);
    const [fadeOutHighlight, setFadeOutHighlight] = useState(false);
    const [alt, setAlt] = useState(false);
    const [hasReceivedA11yFocus, setHasReceivedA11yFocus] = useState(false);
    const [burnOnReadRevealing, setBurnOnReadRevealing] = useState(false);
    const [burnOnReadRevealError, setBurnOnReadRevealError] = useState<string | null>(null);

    const isSystemMessage = PostUtils.isSystemMessage(post);
    const fromAutoResponder = PostUtils.fromAutoResponder(post);

    useEffect(() => {
        if (shouldHighlight) {
            const timer = setTimeout(() => setFadeOutHighlight(true), Constants.PERMALINK_FADEOUT);
            return () => {
                clearTimeout(timer);
            };
        }
        return undefined;
    }, [shouldHighlight]);

    const handleA11yActivateEvent = () => setA11y(true);
    const handleA11yDeactivateEvent = () => setA11y(false);
    const handleAlt = (e: KeyboardEvent) => setAlt(e.altKey);

    const handleA11yKeyboardFocus = useCallback((e: KeyboardEvent) => {
        if (!hasReceivedA11yFocus && shouldHighlight && isKeyPressed(e, Constants.KeyCodes.TAB) && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();

            setHasReceivedA11yFocus(true);

            document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: postRef.current,
                        keyboardOnly: true,
                    },
                },
            ));
        }
    }, [hasReceivedA11yFocus, shouldHighlight]);

    useEffect(() => {
        if (a11yActive) {
            postRef.current?.dispatchEvent(new Event(A11yCustomEventTypes.UPDATE));
        }
    }, [a11yActive]);

    useEffect(() => {
        let removeEventListener: (type: string, listener: EventListener) => void;

        if (postRef.current) {
            postRef.current.addEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
            postRef.current.addEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
            removeEventListener = postRef.current.removeEventListener;
        }

        return () => {
            if (removeEventListener) {
                removeEventListener(A11yCustomEventTypes.ACTIVATE, handleA11yActivateEvent);
                removeEventListener(A11yCustomEventTypes.DEACTIVATE, handleA11yDeactivateEvent);
            }
        };
    }, []);

    useEffect(() => {
        if (hover) {
            document.addEventListener('keydown', handleAlt);
            document.addEventListener('keyup', handleAlt);
        }

        return () => {
            document.removeEventListener('keydown', handleAlt);
            document.removeEventListener('keyup', handleAlt);
        };
    }, [hover]);

    useEffect(() => {
        document.addEventListener('keyup', handleA11yKeyboardFocus);

        return () => {
            document.removeEventListener('keyup', handleA11yKeyboardFocus);
        };
    }, [handleA11yKeyboardFocus]);

    const hasSameRoot = (props: Props) => {
        if (props.isFirstReply) {
            return false;
        } else if (!post.root_id && !props.previousPostIsComment && props.isConsecutivePost) {
            return true;
        } else if (post.root_id) {
            return true;
        }
        return false;
    };

    const getChannelName = () => {
        let name: React.ReactNode = props.channelName;

        const isDirectMessage = props.channelType === Constants.DM_CHANNEL;
        const isPartOfThread = props.isCollapsedThreadsEnabled && (post.reply_count > 0 || post.is_following);

        if (isDirectMessage && isPartOfThread) {
            name = (
                <FormattedMessage
                    id='search_item.thread_direct'
                    defaultMessage='Thread in Direct Message (with {username})'
                    values={{
                        username: props.displayName,
                    }}
                />
            );
        } else if (isPartOfThread) {
            name = (
                <FormattedMessage
                    id='search_item.thread'
                    defaultMessage='Thread in {channel}'
                    values={{
                        channel: props.channelName,
                    }}
                />
            );
        } else if (isDirectMessage) {
            name = (
                <FormattedMessage
                    id='search_item.direct'
                    defaultMessage='Direct Message (with {username})'
                    values={{
                        username: props.displayName,
                    }}
                />
            );
        }

        return name;
    };

    const getPostHeaderVisible = (): boolean | null => {
        const boundingRectOfPostInfo: DOMRect | undefined = postHeaderRef.current?.getBoundingClientRect();

        let isPostHeaderVisibleToUser: boolean | null = null;
        if (boundingRectOfPostInfo) {
            isPostHeaderVisibleToUser = (boundingRectOfPostInfo.top - 65) > 0 &&
                boundingRectOfPostInfo.bottom < (window.innerHeight - 85);
        }

        return isPostHeaderVisibleToUser;
    };

    const getClassName = () => {
        const isMeMessage = checkIsMeMessage(post);
        const hovered =
            hover || fileDropdownOpened || dropdownOpened || a11yActive || props.isPostBeingEdited;
        return classNames('a11y__section post', {
            'post--highlight': shouldHighlight && !fadeOutHighlight,
            'same--root': hasSameRoot(props),
            'other--root': !hasSameRoot(props) && !isSystemMessage,
            'post--bot': PostUtils.isFromBot(post),
            'post--editing': props.isPostBeingEdited,
            'current--user': props.currentUserId === post.user_id && !isSystemMessage,
            'post--system': isSystemMessage || isMeMessage,
            'post--root': props.hasReplies && !(post.root_id && post.root_id.length > 0),
            'post--comment': (post.root_id && post.root_id.length > 0 && !props.isCollapsedThreadsEnabled) || (props.location === Locations.RHS_COMMENT),
            'post--compact': props.compactDisplay,
            'post--hovered': hovered,
            'same--user': props.isConsecutivePost && (!props.compactDisplay || props.location === Locations.RHS_COMMENT),
            'cursor--pointer': alt && !props.channelIsArchived,
            'post--hide-controls': post.failed || post.state === Posts.POST_DELETED,
            'post--comment same--root': fromAutoResponder,
            'post--pinned-or-flagged': (post.is_pinned || props.isFlagged) && props.location === Locations.CENTER,
            'mention-comment': props.isCommentMention,
            'post--thread': isRHS,
        });
    };

    const handleFileDropdownOpened = useCallback((open: boolean) => setFileDropdownOpened(open), []);

    const handleDropdownOpened = useCallback((opened: boolean) => {
        if (togglePostMenu) {
            togglePostMenu(opened);
        }
        setDropdownOpened(opened);
    }, [togglePostMenu]);

    const handleMouseOver = useCallback((e: MouseEvent<HTMLDivElement>) => {
        setHover(true);
        setAlt(e.altKey);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHover(false);
        setAlt(false);
    }, []);

    const handleCardClick = (post?: Post) => {
        if (!post) {
            return;
        }
        if (props.handleCardClick) {
            props.handleCardClick(post);
        }
        props.actions.selectPostCard(post);
    };

    // When adding clickable targets within a root post to exclude from post's on click to open thread,
    // please add to/maintain the selector below
    const isEligibleForClick = useMemo(() => makeIsEligibleForClick('.post-image__column, .embed-responsive-item, .attachment, .hljs, code'), []);

    const handlePostClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (!post || props.channelIsArchived) {
            return;
        }

        // Prevent BoR messages from opening reply
        if (post.type === PostTypes.BURN_ON_READ) {
            return;
        }

        if (
            !e.altKey &&
            props.clickToReply &&
            (fromAutoResponder || !isSystemMessage) &&
            isEligibleForClick(e) &&
            props.location === Locations.CENTER &&
            !props.isPostBeingEdited
        ) {
            props.actions.selectPost(post);
        }

        if (e.altKey) {
            props.actions.markPostAsUnread(post, props.location);
        }
    }, [
        post,
        fromAutoResponder,
        isEligibleForClick,
        isSystemMessage,
        props.channelIsArchived,
        props.clickToReply,
        props.actions,
        props.location,
        props.isPostBeingEdited,
    ]);

    const handleJumpClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (props.isMobileView) {
            props.actions.closeRightHandSide();
        }

        props.actions.setRhsExpanded(false);
        getHistory().push(`/${props.teamName}/pl/${post.id}`);
    }, [props.isMobileView, props.actions, props.teamName, post?.id]);

    const {selectPostFromRightHandSideSearch} = props.actions;

    const handleCommentClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (!post) {
            return;
        }
        selectPostFromRightHandSideSearch(post);
    }, [post, selectPostFromRightHandSideSearch]);

    const handleThreadClick = useCallback((e: React.MouseEvent) => {
        if (props.currentTeam?.id === teamId) {
            handleCommentClick(e);
        } else {
            handleJumpClick(e);
        }
    }, [handleCommentClick, handleJumpClick, props.currentTeam?.id, teamId]);

    const handleRevealBurnOnRead = useCallback(async (postId: string) => {
        setBurnOnReadRevealing(true);
        setBurnOnReadRevealError(null);

        try {
            const result = await props.actions.revealBurnOnReadPost(postId);

            if (result && typeof result === 'object' && 'error' in result) {
                // Handle different error types with i18n
                let errorMessage = formatMessage({
                    id: 'post.burn_on_read.reveal_error.generic',
                    defaultMessage: 'Failed to reveal message. Please try again.',
                });

                if (result.error.status_code === 404) {
                    errorMessage = formatMessage({
                        id: 'post.burn_on_read.reveal_error.not_found',
                        defaultMessage: 'This message is no longer available.',
                    });
                } else if (result.error.status_code === 403) {
                    errorMessage = formatMessage({
                        id: 'post.burn_on_read.reveal_error.forbidden',
                        defaultMessage: "You don't have permission to view this message.",
                    });
                }

                setBurnOnReadRevealError(errorMessage);
            }
        } finally {
            setBurnOnReadRevealing(false);
        }
    }, [props.actions, formatMessage]);

    const handleBurnOnReadClick = useCallback((skipConfirmation: boolean) => {
        const isSender = post.user_id === props.currentUserId;

        if (skipConfirmation) {
            props.actions.burnPostNow?.(post.id);
            return;
        }

        const handlers = createBurnOnReadDeleteModalHandlers(
            props.actions,
            {
                postId: post.id,
                userId: props.currentUserId,
                isSender,
            },
        );

        props.actions.openModal({
            modalId: ModalIdentifiers.BURN_ON_READ_CONFIRMATION,
            dialogType: BurnOnReadConfirmationModal,
            dialogProps: {
                show: true,
                ...handlers,
            },
        });
    }, [props.actions, post.id, post.user_id, props.currentUserId]);

    const handleTimerChipClick = useCallback(() => {
        handleBurnOnReadClick(Boolean(props.burnOnReadSkipConfirmation));
    }, [handleBurnOnReadClick, props.burnOnReadSkipConfirmation]);

    const handleBadgeClick = useCallback(() => {
        handleBurnOnReadClick(false);
    }, [handleBurnOnReadClick]);

    const postClass = classNames('post__body', {'post--edited': PostUtils.isEdited(post), 'search-item-snippet': isSearchResultItem});

    let comment;
    if (props.isFirstReply && post.type !== Constants.PostTypes.EPHEMERAL) {
        comment = (
            <CommentedOn
                onCommentClick={handleCommentClick}
                rootId={post.root_id}
                enablePostUsernameOverride={props.enablePostUsernameOverride}
            />
        );
    }

    let visibleMessage = null;
    if (post.type === Constants.PostTypes.EPHEMERAL && !props.compactDisplay && post.state !== Posts.POST_DELETED) {
        visibleMessage = (
            <span className='post__visibility'>
                <FormattedMessage
                    id='post_info.message.visible'
                    defaultMessage='(Only visible to you)'
                />
            </span>
        );
    }

    let profilePic;
    const hideProfilePicture = hasSameRoot(props) && (!post.root_id && !props.hasReplies) && !PostUtils.isFromBot(post);
    const hideProfileCase = !(props.location === Locations.RHS_COMMENT && props.compactDisplay && props.isConsecutivePost);
    if (!hideProfilePicture && hideProfileCase) {
        profilePic = (
            <PostProfilePicture
                compactDisplay={props.compactDisplay}
                post={post}
                userId={post.user_id}
            />
        );

        if (fromAutoResponder) {
            profilePic = (
                <span className='auto-responder'>
                    {profilePic}
                </span>
            );
        }
    }

    // Determine if we should show concealed placeholder for burn-on-read posts
    const showConcealedPlaceholder = props.shouldDisplayBurnOnReadConcealed && post.type === PostTypes.BURN_ON_READ;

    let message;
    if (showConcealedPlaceholder) {
        message = (
            <BurnOnReadConcealedPlaceholder
                postId={post.id}
                authorName={props.displayName || post.user_id}
                onReveal={handleRevealBurnOnRead}
                loading={burnOnReadRevealing}
                error={burnOnReadRevealError}
            />
        );
    } else if (isSearchResultItem) {
        message = (
            <PostBodyAdditionalContent
                post={post}
                options={{
                    searchTerm: props.term,
                    searchMatches: props.matches,
                }}
            >
                <PostMessageContainer
                    post={post}
                    options={{
                        searchTerm: props.term,
                        searchMatches: props.matches,
                        mentionHighlight: props.isMentionSearch,
                    }}
                    isRHS={isRHS}
                />
            </PostBodyAdditionalContent>
        );
    } else {
        message = (
            <MessageWithAdditionalContent
                post={post}
                isEmbedVisible={props.isEmbedVisible}
                pluginPostTypes={props.pluginPostTypes}
                isRHS={isRHS}
                compactDisplay={props.compactDisplay}
            />
        );
    }

    const slotBasedOnEditOrMessageView = props.isPostBeingEdited ? AutoHeightSlots.SLOT2 : AutoHeightSlots.SLOT1;
    const threadFooter = props.location !== Locations.RHS_ROOT && props.isCollapsedThreadsEnabled && !post.root_id && (props.hasReplies || post.is_following) ? (
        <ThreadFooter
            threadId={post.id}
            replyClick={handleThreadClick}
        />
    ) : null;
    const channelDisplayName = getChannelName();

    // Don't show reactions for unrevealed BoR posts - users can't react to concealed content
    const showReactions = (props.location !== Locations.SEARCH || props.isPinnedPosts || props.isFlaggedPosts) &&
        !props.shouldDisplayBurnOnReadConcealed;

    const getTestId = () => {
        let idPrefix: string;
        switch (props.location) {
        case 'CENTER':
            idPrefix = 'post';
            break;
        case 'RHS_ROOT':
        case 'RHS_COMMENT':
            idPrefix = 'rhsPost';
            break;
        case 'SEARCH':
            idPrefix = 'searchResult';
            break;

        default:
            idPrefix = 'post';
        }

        return idPrefix + `_${post.id}`;
    };

    let priority;
    if (post.metadata?.priority && props.isPostPriorityEnabled && post.state !== Posts.POST_DELETED) {
        priority = <span className='d-flex'><PriorityLabel priority={post.metadata.priority.priority}/></span>;
    }

    // Burn-on-Read badge logic
    // Badge handles expiration scheduling internally via BurnOnReadExpirationHandler
    // Only shows on first post in series (not consecutive posts)
    let burnOnReadBadge;
    const isBoRPost = post.type === PostTypes.BURN_ON_READ && post.state !== Posts.POST_DELETED && !props.isConsecutivePost;
    if (isBoRPost) {
        const isSender = post.user_id === props.currentUserId;
        const revealed = typeof post.metadata?.expire_at === 'number';

        // Parse expiration times - can be either number or string from API
        // For revealed posts: metadata.expire_at contains the reveal timer
        // For unrevealed posts: props.expire_at contains the maximum TTL
        let expireAt = null;
        if (typeof post.metadata?.expire_at === 'number') {
            expireAt = post.metadata.expire_at;
        } else if (post.metadata?.expire_at) {
            expireAt = parseInt(String(post.metadata.expire_at), 10);
        }

        let maxExpireAt = null;
        if (!revealed) {
            // Unrevealed posts: read maximum TTL from props.expire_at
            if (typeof post.props?.expire_at === 'number') {
                maxExpireAt = post.props.expire_at;
            } else if (post.props?.expire_at) {
                maxExpireAt = parseInt(String(post.props.expire_at), 10);
            }
        }

        burnOnReadBadge = (
            <BurnOnReadBadge
                post={post}
                isSender={isSender}
                revealed={revealed}
                expireAt={expireAt && !isNaN(expireAt) ? expireAt : null}
                maxExpireAt={maxExpireAt && !isNaN(maxExpireAt) ? maxExpireAt : null}
                onReveal={handleRevealBurnOnRead}
                onSenderDelete={handleBadgeClick}
            />
        );
    }

    // Burn-on-Read countdown timer chip
    // Displays when expire_at is set (after reveal for receivers, after all reveal for sender)
    let burnOnReadTimerChip;
    if (isBoRPost) {
        const hasExpireAt = typeof post.metadata?.expire_at === 'number';

        if (hasExpireAt) {
            burnOnReadTimerChip = (
                <BurnOnReadTimerChip
                    expireAt={post.metadata.expire_at as number}
                    onClick={handleTimerChipClick}
                />
            );
        }
    }

    let postAriaLabelDivTestId = '';
    if (props.location === Locations.CENTER) {
        postAriaLabelDivTestId = 'postView';
    } else if (props.location === Locations.RHS_ROOT || props.location === Locations.RHS_COMMENT) {
        postAriaLabelDivTestId = 'rhsPostView';
    }

    // Don't show file attachments for concealed burn-on-read posts (attachments only fetched after reveal)
    const showFileAttachments = post.file_ids && post.file_ids.length > 0 && !props.isPostBeingEdited && !showConcealedPlaceholder;

    return (
        <>
            <PostAriaLabelDiv
                ref={postRef}
                id={getTestId()}
                data-testid={postAriaLabelDivTestId}
                post={post}
                className={getClassName()}
                onClick={handlePostClick}
                onMouseOver={handleMouseOver}
                onMouseLeave={handleMouseLeave}
            >
                {(Boolean(isSearchResultItem) || (props.location !== Locations.CENTER && props.isFlagged)) &&
                    <div
                        className='search-channel__name__container'
                        aria-hidden='true'
                    >
                        {(Boolean(isSearchResultItem) || props.isFlaggedPosts) &&
                        <span className='search-channel__name'>
                            {channelDisplayName}
                        </span>
                        }
                        {props.channelIsArchived &&
                        <span className='search-channel__archived'>
                            <ArchiveIcon className='icon icon__archive channel-header-archived-icon svg-text-color'/>
                            <FormattedMessage
                                id='search_item.channelArchived'
                                defaultMessage='Archived'
                            />
                        </span>
                        }
                        {(Boolean(isSearchResultItem) || props.isFlaggedPosts) && Boolean(props.teamDisplayName) &&
                        <span className='search-team__name'>
                            {props.teamDisplayName}
                        </span>
                        }
                    </div>
                }
                <PostPreHeader
                    isFlagged={props.isFlagged}
                    isPinned={post.is_pinned}
                    skipPinned={props.location === Locations.SEARCH && props.isPinnedPosts}
                    skipFlagged={props.location === Locations.SEARCH && props.isFlaggedPosts}
                    channelId={post.channel_id}
                />
                <div
                    className={`post__content ${props.center ? 'center' : ''}`}
                    data-testid='postContent'
                >
                    <div className='post__img'>
                        {profilePic}
                    </div>
                    <div>
                        <div
                            className='post__header'
                            ref={postHeaderRef}
                        >
                            <PostUserProfile
                                {...props}
                                isSystemMessage={isSystemMessage}
                            />
                            <div className='badges-wrapper col d-flex align-items-center'>
                                {((!hideProfilePicture && props.location === Locations.CENTER) || hover || props.location !== Locations.CENTER) &&
                                    <PostTime
                                        isPermalink={!(Posts.POST_DELETED === post.state || isPostPendingOrFailed(post))}
                                        teamName={props.team?.name}
                                        eventTime={post.create_at}
                                        postId={post.id}
                                        location={props.location}
                                        timestampProps={{...props.timestampProps, style: props.isConsecutivePost && !props.compactDisplay ? 'narrow' : undefined}}
                                    />
                                }
                                {priority}
                                {burnOnReadBadge}
                                {burnOnReadTimerChip}
                                {((!props.compactDisplay && !(hasSameRoot(props) && props.isConsecutivePost)) || (props.compactDisplay && isRHS)) &&
                                    PostUtils.hasAiGeneratedMetadata(post) && (
                                    <AiGeneratedIndicator
                                        userId={post.props.ai_generated_by as string}
                                        username={post.props.ai_generated_by_username as string}
                                        postAuthorId={post.user_id}
                                    />
                                )}
                                {Boolean(post.props && post.props.card) &&
                                    <WithTooltip
                                        title={
                                            <FormattedMessage
                                                id='post_info.info.view_additional_info'
                                                defaultMessage='View additional info'
                                            />
                                        }
                                    >
                                        <button
                                            className={'card-icon__container icon--show style--none ' + (props.isCardOpen ? 'active' : '')}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleCardClick(post);
                                            }}
                                        >
                                            <InfoSmallIcon
                                                className='icon icon__info'
                                                aria-hidden='true'
                                            />
                                        </button>
                                    </WithTooltip>
                                }
                                {visibleMessage}
                            </div>
                            {!props.isPostBeingEdited &&
                            <PostOptions
                                {...props}
                                teamId={teamId}
                                handleDropdownOpened={handleDropdownOpened}
                                handleCommentClick={handleCommentClick}
                                hover={hover || a11yActive}
                                removePost={props.actions.removePost}
                                handleJumpClick={handleJumpClick}
                                isPostHeaderVisible={getPostHeaderVisible()}
                            />
                            }
                        </div>
                        {comment}
                        <div
                            className={postClass}
                            id={isRHS ? undefined : `${post.id}_message`}
                        >
                            {post.failed && <FailedPostOptions post={post}/>}
                            <AutoHeightSwitcher
                                showSlot={slotBasedOnEditOrMessageView}
                                shouldScrollIntoView={props.isPostBeingEdited}
                                slot1={message}
                                slot2={<EditPost/>}
                                onTransitionEnd={() => document.dispatchEvent(new Event(AppEvents.FOCUS_EDIT_TEXTBOX))}
                            />
                            {
                                showFileAttachments &&
                                <FileAttachmentListContainer
                                    post={post}
                                    compactDisplay={props.compactDisplay}
                                    handleFileDropdownOpened={handleFileDropdownOpened}
                                />
                            }
                            <div className='post__body-reactions-acks'>
                                {props.isPostAcknowledgementsEnabled && post.metadata?.priority?.requested_ack && (
                                    <PostAcknowledgements
                                        authorId={post.user_id}
                                        isDeleted={post.state === Posts.POST_DELETED}
                                        postId={post.id}
                                    />
                                )}
                                {showReactions && <ReactionList post={post}/>}
                            </div>
                            {threadFooter}
                        </div>
                    </div>
                </div>
            </PostAriaLabelDiv>
        </>
    );
}

export default withPostErrorBoundary(PostComponent);
