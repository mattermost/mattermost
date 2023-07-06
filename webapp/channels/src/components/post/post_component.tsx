// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {MouseEvent, useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import {Posts} from 'mattermost-redux/constants/index';
import {
    isMeMessage as checkIsMeMessage,
    isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import Constants, {A11yCustomEventTypes, A11yFocusEventDetail, AppEvents, Locations} from 'utils/constants';

import * as PostUtils from 'utils/post_utils';

import {PostPluginComponent} from 'types/store/plugins';

import FileAttachmentListContainer from 'components/file_attachment_list';
import DateSeparator from 'components/post_view/date_separator';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import PostProfilePicture from 'components/post_profile_picture';
import FailedPostOptions from 'components/post_view/failed_post_options';
import PostAriaLabelDiv from 'components/post_view/post_aria_label_div';
import PostTime from 'components/post_view/post_time';
import ReactionList from 'components/post_view/reaction_list';
import MessageWithAdditionalContent from 'components/message_with_additional_content';
import InfoSmallIcon from 'components/widgets/icons/info_small_icon';
import ArchiveIcon from 'components/widgets/icons/archive_icon';
import PostPreHeader from 'components/post_view/post_pre_header';
import EditPost from 'components/edit_post';
import AutoHeightSwitcher, {AutoHeightSlots} from 'components/common/auto_height_switcher';
import {Props as TimestampProps} from 'components/timestamp/timestamp';
import ThreadFooter from 'components/threading/channel_threads/thread_footer';
import PostAcknowledgements from 'components/post_view/acknowledgements';
import PostBodyAdditionalContent from 'components/post_view/post_body_additional_content';
import PostMessageContainer from 'components/post_view/post_message_view';
import {getDateForUnixTicks, makeIsEligibleForClick} from 'utils/utils';
import {getHistory} from 'utils/browser_history';
import {isKeyPressed} from 'utils/keyboard';

import {trackEvent} from 'actions/telemetry_actions';

import CommentedOn from 'components/post_view/commented_on/commented_on';
import PriorityLabel from 'components/post_priority/post_priority_label';

import {UserProfile} from '@mattermost/types/users';
import {Post} from '@mattermost/types/posts';
import {Emoji} from '@mattermost/types/emojis';

import PostUserProfile from './user_profile';
import PostOptions from './post_options';
import {Team} from '@mattermost/types/teams';

export type Props = {
    post: Post;
    currentTeam: Team;
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
        setActionsMenuInitialisationState: (viewed: Record<string, boolean>) => void;
        selectPost: (post: Post) => void;
        selectPostFromRightHandSideSearch: (post: Post) => void;
        removePost: (post: Post) => void;
        closeRightHandSide: () => void;
        selectPostCard: (post: Post) => void;
        setRhsExpanded: (rhsExpanded: boolean) => void;
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
};

const PostComponent = (props: Props): JSX.Element => {
    console.log(`PostComponent id: ${props.post.id} isDeleted: ${props.post.delete_at} state: ${props.post.state}`);

    const {post, shouldHighlight, togglePostMenu} = props;

    const isSearchResultItem = (props.matches && props.matches.length > 0) || props.isMentionSearch || (props.term && props.term.length > 0);
    const isRHS = props.location === Locations.RHS_ROOT || props.location === Locations.RHS_COMMENT || props.location === Locations.SEARCH;
    const postRef = useRef<HTMLDivElement>(null);
    const postHeaderRef = useRef<HTMLDivElement>(null);
    const teamId = props.team?.id || props.currentTeam.id;

    const [hover, setHover] = useState(false);
    const [a11yActive, setA11y] = useState(false);
    const [dropdownOpened, setDropdownOpened] = useState(false);
    const [fileDropdownOpened, setFileDropdownOpened] = useState(false);
    const [fadeOutHighlight, setFadeOutHighlight] = useState(false);
    const [alt, setAlt] = useState(false);
    const [hasReceivedA11yFocus, setHasReceivedA11yFocus] = useState(false);

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
            'post--thread': props.location === Locations.RHS_COMMENT || props.location === Locations.RHS_ROOT,
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

        if (
            !e.altKey &&
            props.clickToReply &&
            (fromAutoResponder || !isSystemMessage) &&
            isEligibleForClick(e) &&
            props.location === Locations.CENTER &&
            !props.isPostBeingEdited
        ) {
            trackEvent('crt', 'clicked_to_reply');
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

    const handleCommentClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (!post) {
            return;
        }
        props.actions.selectPostFromRightHandSideSearch(post);
    }, [post, props.actions, props.actions.selectPostFromRightHandSideSearch]);

    const handleThreadClick = useCallback((e: React.MouseEvent) => {
        if (props.currentTeam.id === teamId) {
            handleCommentClick(e);
        } else {
            handleJumpClick(e);
        }
    }, [handleCommentClick, handleJumpClick, props.currentTeam.id, teamId]);

    const postClass = classNames('post__body', {'post--edited': PostUtils.isEdited(post), 'search-item-snippet': isSearchResultItem});

    let comment;
    if (props.isFirstReply && props.parentPost && props.parentPostUser && post.type !== Constants.PostTypes.EPHEMERAL) {
        comment = (
            <CommentedOn
                post={props.parentPost}
                parentPostUser={props.parentPostUser}
                onCommentClick={handleCommentClick}
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

    const message = isSearchResultItem ? (
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
    ) : (
        <MessageWithAdditionalContent
            post={post}
            isEmbedVisible={props.isEmbedVisible}
            pluginPostTypes={props.pluginPostTypes}
            isRHS={isRHS}
            compactDisplay={props.compactDisplay}
        />
    );

    const showSlot = props.isPostBeingEdited ? AutoHeightSlots.SLOT2 : AutoHeightSlots.SLOT1;
    const threadFooter = props.location !== Locations.RHS_ROOT && props.isCollapsedThreadsEnabled && !post.root_id && (props.hasReplies || post.is_following) ? (
        <ThreadFooter
            threadId={post.id}
            replyClick={handleThreadClick}
        />
    ) : null;
    const currentPostDay = getDateForUnixTicks(post.create_at);
    const channelDisplayName = getChannelName();
    const showReactions = props.location !== Locations.SEARCH || props.isPinnedPosts || props.isFlaggedPosts;

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
    if (post.metadata?.priority && props.isPostPriorityEnabled) {
        priority = <span className='d-flex mr-2 ml-1'><PriorityLabel priority={post.metadata.priority.priority}/></span>;
    }

    return (
        <>
            {(isSearchResultItem || (props.location !== Locations.CENTER && (props.isPinnedPosts || props.isFlaggedPosts))) && <DateSeparator date={currentPostDay}/>}
            <PostAriaLabelDiv
                ref={postRef}
                role='listitem'
                id={getTestId()}
                data-testid={props.location === 'CENTER' ? 'postView' : ''}
                tabIndex={0}
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
                        {Boolean(isSearchResultItem) &&
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
                        {Boolean(isSearchResultItem) && Boolean(props.teamDisplayName) &&
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
                    role='application'
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
                            <div className='col d-flex align-items-center'>
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
                                {post.props && post.props.card &&
                                    <OverlayTrigger
                                        delayShow={Constants.OVERLAY_TIME_DELAY}
                                        placement='top'
                                        overlay={
                                            <Tooltip>
                                                <FormattedMessage
                                                    id='post_info.info.view_additional_info'
                                                    defaultMessage='View additional info'
                                                />
                                            </Tooltip>
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
                                    </OverlayTrigger>
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
                                showSlot={showSlot}
                                shouldScrollIntoView={props.isPostBeingEdited}
                                slot1={message}
                                slot2={<EditPost/>}
                                onTransitionEnd={() => document.dispatchEvent(new Event(AppEvents.FOCUS_EDIT_TEXTBOX))}
                            />
                            {post.file_ids && post.file_ids.length > 0 &&
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
};

export default PostComponent;
