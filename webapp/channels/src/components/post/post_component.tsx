// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import type {MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {Team} from '@mattermost/types/teams';

import {Posts} from 'mattermost-redux/constants/index';
import {
    isMeMessage as checkIsMeMessage,
    isPostPendingOrFailed} from 'mattermost-redux/utils/post_utils';

import {trackEvent} from 'actions/telemetry_actions';

import AutoHeightSwitcher, {AutoHeightSlots} from 'components/common/auto_height_switcher';
import EditPost from 'components/edit_post';
import FileAttachmentListContainer from 'components/file_attachment_list';
import MessageWithAdditionalContent from 'components/message_with_additional_content';
import PriorityLabel from 'components/post_priority/post_priority_label';
import PostProfilePicture from 'components/post_profile_picture';
import PostAcknowledgements from 'components/post_view/acknowledgements';
import CommentedOn from 'components/post_view/commented_on/commented_on';
import DateSeparator from 'components/post_view/date_separator';
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

import {getHistory} from 'utils/browser_history';
import Constants, {A11yCustomEventTypes, AppEvents, Locations} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';
import * as PostUtils from 'utils/post_utils';
import {getDateForUnixTicks, makeIsEligibleForClick} from 'utils/utils';

import type {PostPluginComponent} from 'types/store/plugins';

import PostOptions from './post_options';
import PostUserProfile from './user_profile';

export type Props = {
    post: Post;
    currentTeam?: Team;
    team?: Team;
    currentUserId: string;
    compactDisplay?: boolean;
    isFlagged: boolean;
    isEmbedVisible?: boolean;
    pluginPostTypes?: {[postType: string]: PostPluginComponent};
    channelIsArchived?: boolean;
    isConsecutivePost?: boolean;
    isLastPost?: boolean;
    center: boolean;
    handleCardClick?: (post: Post) => void;
    togglePostMenu?: (opened: boolean) => void;
    channelName?: string;
    displayName: string;
    teamDisplayName?: string;
    teamName?: string;
    channelType?: string;
    hasReplies: boolean;
    isFirstReply?: boolean;
    previousPostIsComment?: boolean;
    matches?: string[];
    term?: string;
    isMentionSearch?: boolean;
    location: keyof typeof Locations;
    actions: {
        markPostAsUnread: (post: Post, location: string) => void;
        selectPost: (post: Post) => void;
        selectPostFromRightHandSideSearch: (post: Post) => void;
        closeRightHandSide: () => void;
        selectPostCard: (post: Post) => void;
        setRhsExpanded: (rhsExpanded: boolean) => void;
    };
    timestampProps?: Partial<TimestampProps>;
    shouldHighlight?: boolean;
    isPostBeingEdited?: boolean;
    isCollapsedThreadsEnabled?: boolean;
    isMobileView: boolean;
    isFlaggedPosts?: boolean;
    isPinnedPosts?: boolean;
    clickToReply?: boolean;
    isCommentMention?: boolean;
    isPostAcknowledgementsEnabled: boolean;
    isPostPriorityEnabled: boolean;
    isCardOpen?: boolean;
};

const autoHeightSlot2 = <EditPost/>;
const tooltipTitle = (
    <FormattedMessage
        id='post_info.info.view_additional_info'
        defaultMessage='View additional info'
    />
);

const PostComponent = ({
    actions: {
        closeRightHandSide,
        markPostAsUnread,
        selectPost,
        selectPostCard,
        selectPostFromRightHandSideSearch,
        setRhsExpanded,
    },
    center,
    currentUserId,
    displayName,
    hasReplies,
    isFlagged,
    isMobileView,
    isPostAcknowledgementsEnabled,
    isPostPriorityEnabled,
    location,
    post,
    channelIsArchived,
    channelName,
    channelType,
    clickToReply,
    compactDisplay,
    currentTeam,
    handleCardClick: receivedHandleCardClick,
    isCardOpen,
    isCollapsedThreadsEnabled,
    isCommentMention,
    isConsecutivePost,
    isEmbedVisible,
    isFirstReply,
    isFlaggedPosts,
    isLastPost,
    isMentionSearch,
    isPinnedPosts,
    isPostBeingEdited,
    matches,
    pluginPostTypes,
    previousPostIsComment,
    shouldHighlight,
    team,
    teamDisplayName,
    teamName,
    term,
    timestampProps: timestampPropsReceived,
    togglePostMenu,
}: Props): JSX.Element => {
    const isSearchResultItem = (matches && matches.length > 0) || isMentionSearch || (term && term.length > 0);
    const isRHS = location === Locations.RHS_ROOT || location === Locations.RHS_COMMENT || location === Locations.SEARCH;
    const postRef = useRef<HTMLDivElement>(null);
    const postHeaderRef = useRef<HTMLDivElement>(null);
    const teamId = team?.id ?? currentTeam?.id ?? '';

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

    const hasSameRoot = () => {
        if (isFirstReply) {
            return false;
        } else if (!post.root_id && !previousPostIsComment && isConsecutivePost) {
            return true;
        } else if (post.root_id) {
            return true;
        }
        return false;
    };

    const getChannelName = () => {
        let name: React.ReactNode = channelName;

        const isDirectMessage = channelType === Constants.DM_CHANNEL;
        const isPartOfThread = isCollapsedThreadsEnabled && (post.reply_count > 0 || post.is_following);

        if (isDirectMessage && isPartOfThread) {
            name = (
                <FormattedMessage
                    id='search_item.thread_direct'
                    defaultMessage='Thread in Direct Message (with {username})'
                    values={{
                        username: displayName,
                    }}
                />
            );
        } else if (isPartOfThread) {
            name = (
                <FormattedMessage
                    id='search_item.thread'
                    defaultMessage='Thread in {channel}'
                    values={{
                        channel: channelName,
                    }}
                />
            );
        } else if (isDirectMessage) {
            name = (
                <FormattedMessage
                    id='search_item.direct'
                    defaultMessage='Direct Message (with {username})'
                    values={{
                        username: displayName,
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
            hover || fileDropdownOpened || dropdownOpened || a11yActive || isPostBeingEdited;
        return classNames('a11y__section post', {
            'post--highlight': shouldHighlight && !fadeOutHighlight,
            'same--root': hasSameRoot(),
            'other--root': !hasSameRoot() && !isSystemMessage,
            'post--bot': PostUtils.isFromBot(post),
            'post--editing': isPostBeingEdited,
            'current--user': currentUserId === post.user_id && !isSystemMessage,
            'post--system': isSystemMessage || isMeMessage,
            'post--root': hasReplies && !(post.root_id && post.root_id.length > 0),
            'post--comment': (post.root_id && post.root_id.length > 0 && !isCollapsedThreadsEnabled) || (location === Locations.RHS_COMMENT),
            'post--compact': compactDisplay,
            'post--hovered': hovered,
            'same--user': isConsecutivePost && (!compactDisplay || location === Locations.RHS_COMMENT),
            'cursor--pointer': alt && !channelIsArchived,
            'post--hide-controls': post.failed || post.state === Posts.POST_DELETED,
            'post--comment same--root': fromAutoResponder,
            'post--pinned-or-flagged': (post.is_pinned || isFlagged) && location === Locations.CENTER,
            'mention-comment': isCommentMention,
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

    const handleCardClick = useCallback((post?: Post) => {
        if (!post) {
            return;
        }
        if (receivedHandleCardClick) {
            receivedHandleCardClick(post);
        }
        selectPostCard(post);
    }, [receivedHandleCardClick, selectPostCard]);

    // When adding clickable targets within a root post to exclude from post's on click to open thread,
    // please add to/maintain the selector below
    const isEligibleForClick = useMemo(() => makeIsEligibleForClick('.post-image__column, .embed-responsive-item, .attachment, .hljs, code'), []);

    const handlePostClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
        if (!post || channelIsArchived) {
            return;
        }

        if (
            !e.altKey &&
            clickToReply &&
            (fromAutoResponder || !isSystemMessage) &&
            isEligibleForClick(e) &&
            location === Locations.CENTER &&
            !isPostBeingEdited
        ) {
            trackEvent('crt', 'clicked_to_reply');
            selectPost(post);
        }

        if (e.altKey) {
            markPostAsUnread(post, location);
        }
    }, [
        post,
        channelIsArchived,
        clickToReply,
        fromAutoResponder,
        isSystemMessage,
        isEligibleForClick,
        location,
        isPostBeingEdited,
        selectPost,
        markPostAsUnread,
    ]);

    const handleJumpClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (isMobileView) {
            closeRightHandSide();
        }

        setRhsExpanded(false);
        getHistory().push(`/${teamName}/pl/${post.id}`);
    }, [isMobileView, setRhsExpanded, teamName, post.id, closeRightHandSide]);

    const handleCommentClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        if (!post) {
            return;
        }
        selectPostFromRightHandSideSearch(post);
    }, [post, selectPostFromRightHandSideSearch]);

    const handleThreadClick = useCallback((e: React.MouseEvent) => {
        if (currentTeam?.id === teamId) {
            handleCommentClick(e);
        } else {
            handleJumpClick(e);
        }
    }, [currentTeam?.id, handleCommentClick, handleJumpClick, teamId]);

    const postClass = classNames('post__body', {'post--edited': PostUtils.isEdited(post), 'search-item-snippet': isSearchResultItem});

    const comment = (isFirstReply && post.type !== Constants.PostTypes.EPHEMERAL) && (
        <CommentedOn
            rootId={post.root_id}
            onCommentClick={handleCommentClick}
        />
    );

    let visibleMessage = null;
    if (post.type === Constants.PostTypes.EPHEMERAL && !compactDisplay && post.state !== Posts.POST_DELETED) {
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
    const hideProfilePicture = hasSameRoot() && (!post.root_id && !hasReplies) && !PostUtils.isFromBot(post);
    const hideProfileCase = !(location === Locations.RHS_COMMENT && compactDisplay && isConsecutivePost);
    if (!hideProfilePicture && hideProfileCase) {
        profilePic = (
            <PostProfilePicture
                compactDisplay={compactDisplay}
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

    const message = useMemo(() => (isSearchResultItem ? (
        <PostBodyAdditionalContent
            post={post}
            options={{
                searchTerm: term,
                searchMatches: matches,
            }}
        >
            <PostMessageContainer
                post={post}
                options={{
                    searchTerm: term,
                    searchMatches: matches,
                    mentionHighlight: isMentionSearch,
                }}
                isRHS={isRHS}
            />
        </PostBodyAdditionalContent>
    ) : (
        <MessageWithAdditionalContent
            post={post}
            isEmbedVisible={isEmbedVisible}
            pluginPostTypes={pluginPostTypes}
            isRHS={isRHS}
            compactDisplay={compactDisplay}
        />
    )), [compactDisplay, isEmbedVisible, isMentionSearch, isRHS, isSearchResultItem, matches, pluginPostTypes, post, term]);

    const showSlot = isPostBeingEdited ? AutoHeightSlots.SLOT2 : AutoHeightSlots.SLOT1;
    const threadFooter = location !== Locations.RHS_ROOT && isCollapsedThreadsEnabled && !post.root_id && (hasReplies || post.is_following) && (
        <ThreadFooter
            threadId={post.id}
            replyClick={handleThreadClick}
        />
    );

    const currentPostDay = useMemo(() => getDateForUnixTicks(post.create_at), [post.create_at]);
    const channelDisplayName = getChannelName();
    const showReactions = location !== Locations.SEARCH || isPinnedPosts || isFlaggedPosts;

    const getTestId = () => {
        let idPrefix: string;
        switch (location) {
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

    const priority = (post.metadata?.priority && isPostPriorityEnabled) && (
        <span className='d-flex mr-2 ml-1'><PriorityLabel priority={post.metadata.priority.priority}/></span>
    );

    let postAriaLabelDivTestId = '';
    if (location === Locations.CENTER) {
        postAriaLabelDivTestId = 'postView';
    } else if (location === Locations.RHS_ROOT || location === Locations.RHS_COMMENT) {
        postAriaLabelDivTestId = 'rhsPostView';
    }

    const autoHeightTransition = useCallback(() => document.dispatchEvent(new Event(AppEvents.FOCUS_EDIT_TEXTBOX)), []);
    const tooltipClick = useCallback((e) => {
        e.preventDefault();
        handleCardClick(post);
    }, [handleCardClick, post]);

    const timestampProps = useMemo(
        () => ({...timestampPropsReceived, style: isConsecutivePost && !compactDisplay ? 'narrow' : undefined} as const),
        [compactDisplay, isConsecutivePost, timestampPropsReceived],
    );

    return (
        <>
            {(isSearchResultItem || (location !== Locations.CENTER && (isPinnedPosts || isFlaggedPosts))) && <DateSeparator date={currentPostDay}/>}
            <PostAriaLabelDiv
                ref={postRef}
                id={getTestId()}
                data-testid={postAriaLabelDivTestId}
                tabIndex={0}
                post={post}
                className={getClassName()}
                onClick={handlePostClick}
                onMouseOver={handleMouseOver}
                onMouseLeave={handleMouseLeave}
            >
                {(Boolean(isSearchResultItem) || (location !== Locations.CENTER && isFlagged)) &&
                    <div
                        className='search-channel__name__container'
                        aria-hidden='true'
                    >
                        {(Boolean(isSearchResultItem) || isFlaggedPosts) &&
                        <span className='search-channel__name'>
                            {channelDisplayName}
                        </span>
                        }
                        {channelIsArchived &&
                        <span className='search-channel__archived'>
                            <ArchiveIcon className='icon icon__archive channel-header-archived-icon svg-text-color'/>
                            <FormattedMessage
                                id='search_item.channelArchived'
                                defaultMessage='Archived'
                            />
                        </span>
                        }
                        {(Boolean(isSearchResultItem) || isFlaggedPosts) && Boolean(teamDisplayName) &&
                        <span className='search-team__name'>
                            {teamDisplayName}
                        </span>
                        }
                    </div>
                }
                <PostPreHeader
                    isFlagged={isFlagged}
                    isPinned={post.is_pinned}
                    skipPinned={location === Locations.SEARCH && isPinnedPosts}
                    skipFlagged={location === Locations.SEARCH && isFlaggedPosts}
                    channelId={post.channel_id}
                />
                <div
                    role='application'
                    className={`post__content ${center ? 'center' : ''}`}
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
                                isMobileView={isMobileView}
                                post={post}
                                compactDisplay={compactDisplay}
                                isConsecutivePost={isConsecutivePost}
                                isSystemMessage={isSystemMessage}
                            />
                            <div className='col d-flex align-items-center'>
                                {((!hideProfilePicture && location === Locations.CENTER) || hover || location !== Locations.CENTER) &&
                                    <PostTime
                                        isPermalink={!(Posts.POST_DELETED === post.state || isPostPendingOrFailed(post))}
                                        teamName={team?.name}
                                        eventTime={post.create_at}
                                        postId={post.id}
                                        location={location}
                                        timestampProps={timestampProps}
                                    />
                                }
                                {priority}
                                {post.props && post.props.card &&
                                    <WithTooltip
                                        id='post_info.info.view_additional_info'
                                        title={tooltipTitle}
                                        placement='top'
                                    >
                                        <button
                                            className={'card-icon__container icon--show style--none ' + (isCardOpen ? 'active' : '')}
                                            onClick={tooltipClick}
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
                            {!isPostBeingEdited &&
                            <PostOptions
                                isFlagged={isFlagged}
                                isMobileView={isMobileView}
                                location={location}
                                post={post}
                                channelIsArchived={channelIsArchived}
                                hasReplies={hasReplies}
                                isFirstReply={isFirstReply}
                                isLastPost={isLastPost}
                                isPostBeingEdited={isPostBeingEdited}
                                teamId={teamId}
                                handleDropdownOpened={handleDropdownOpened}
                                handleCommentClick={handleCommentClick}
                                hover={hover || a11yActive}
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
                                shouldScrollIntoView={isPostBeingEdited}
                                slot1={message}
                                slot2={autoHeightSlot2}
                                onTransitionEnd={autoHeightTransition}
                            />
                            {post.file_ids && post.file_ids.length > 0 &&
                            <FileAttachmentListContainer
                                post={post}
                                compactDisplay={compactDisplay}
                                handleFileDropdownOpened={handleFileDropdownOpened}
                            />
                            }
                            <div className='post__body-reactions-acks'>
                                {isPostAcknowledgementsEnabled && post.metadata?.priority?.requested_ack && (
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
