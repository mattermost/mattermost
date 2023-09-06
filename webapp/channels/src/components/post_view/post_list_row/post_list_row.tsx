// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {CloudUsage, Limits} from '@mattermost/types/cloud';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import * as PostListUtils from 'mattermost-redux/utils/post_list';

import type {emitShortcutReactToLastPostFrom} from 'actions/post_actions';

import CenterMessageLock from 'components/center_message_lock';
import PostComponent from 'components/post';
import ChannelIntroMessage from 'components/post_view/channel_intro_message/';
import CombinedUserActivityPost from 'components/post_view/combined_user_activity_post';
import DateSeparator from 'components/post_view/date_separator';
import NewMessageSeparator from 'components/post_view/new_message_separator/new_message_separator';

import {PostListRowListIds, Locations} from 'utils/constants';
import {isIdNotPost} from 'utils/post_utils';

import type {PluginComponent} from 'types/store/plugins';

export type PostListRowProps = {
    listId: string;
    previousListId?: string;
    fullWidth?: boolean;
    shouldHighlight?: boolean;
    loadOlderPosts: () => void;
    loadNewerPosts: () => void;
    togglePostMenu: (opened: boolean) => void;
    post: Post;
    currentUserId: UserProfile['id'];

    /**
     * To Check if the current post is last in the list
     */
    isLastPost: boolean;

    /**
     * To check if the state of emoji for last message and from where it was emitted
     */
    shortcutReactToLastPostEmittedFrom: string;

    /**
     * is used for hiding animation of loader
     */
    loadingNewerPosts: boolean;
    loadingOlderPosts: boolean;

    usage: CloudUsage;
    limits: Limits;
    limitsLoaded: boolean;
    exceededLimitChannelId?: string;
    firstInaccessiblePostTime?: number;
    lastViewedAt: number;
    channelId: string;

    newMessagesSeparatorActions: PluginComponent[];

    actions: {

        /**
          * Function to set or unset emoji picker for last message
          */
        emitShortcutReactToLastPostFrom: typeof emitShortcutReactToLastPostFrom;
    };
}

export default class PostListRow extends React.PureComponent<PostListRowProps> {
    blockShortcutReactToLastPostForNonMessages(listId: string) {
        const {actions: {emitShortcutReactToLastPostFrom}} = this.props;

        if (isIdNotPost(listId)) {
            // This is a good escape hatch as any of the above conditions don't return <Post/> component, Emoji picker is only at Post component
            emitShortcutReactToLastPostFrom(Locations.NO_WHERE);
        }
    }

    componentDidUpdate(prevProps: PostListRowProps) {
        const {listId, isLastPost, shortcutReactToLastPostEmittedFrom} = this.props;

        const shortcutReactToLastPostEmittedFromCenter = prevProps.shortcutReactToLastPostEmittedFrom !== shortcutReactToLastPostEmittedFrom &&
            shortcutReactToLastPostEmittedFrom === Locations.CENTER;

        // If last post is not a message then we block the shortcut to react to last message, early on
        if (isLastPost && shortcutReactToLastPostEmittedFromCenter) {
            this.blockShortcutReactToLastPostForNonMessages(listId);
        }
    }

    render() {
        const {listId, previousListId, loadingOlderPosts, loadingNewerPosts} = this.props;
        const {
            OLDER_MESSAGES_LOADER,
            NEWER_MESSAGES_LOADER,
            CHANNEL_INTRO_MESSAGE,
            LOAD_OLDER_MESSAGES_TRIGGER,
            LOAD_NEWER_MESSAGES_TRIGGER,
        } = PostListRowListIds;

        if (PostListUtils.isDateLine(listId)) {
            const date = PostListUtils.getDateForDateLine(listId);

            return (
                <DateSeparator
                    key={date}
                    date={date}
                />
            );
        }

        if (PostListUtils.isStartOfNewMessages(listId)) {
            return (
                <NewMessageSeparator
                    separatorId={listId}
                    newMessagesSeparatorActions={this.props.newMessagesSeparatorActions}
                    channelId={this.props.channelId}
                    lastViewedAt={this.props.lastViewedAt}
                />
            );
        }

        if (this.props.exceededLimitChannelId) {
            return (
                <CenterMessageLock
                    channelId={this.props.exceededLimitChannelId}
                    firstInaccessiblePostTime={this.props.firstInaccessiblePostTime}
                />
            );
        }

        if (listId === CHANNEL_INTRO_MESSAGE) {
            return (
                <ChannelIntroMessage/>
            );
        }

        if (listId === LOAD_OLDER_MESSAGES_TRIGGER || listId === LOAD_NEWER_MESSAGES_TRIGGER) {
            return (
                <button
                    className='more-messages-text theme style--none color--link'
                    onClick={listId === LOAD_OLDER_MESSAGES_TRIGGER ? this.props.loadOlderPosts : this.props.loadNewerPosts}
                >
                    <FormattedMessage
                        id='posts_view.loadMore'
                        defaultMessage='Load More Messages'
                    />
                </button>
            );
        }

        const isOlderMessagesLoader = listId === OLDER_MESSAGES_LOADER;
        const isNewerMessagesLoader = listId === NEWER_MESSAGES_LOADER;
        if (isOlderMessagesLoader || isNewerMessagesLoader) {
            const shouldHideAnimation = !loadingOlderPosts && !loadingNewerPosts;

            return (
                <div
                    className='loading-screen'
                >
                    <div className={classNames('loading__content', {hideAnimation: shouldHideAnimation})}>
                        <div className='round round-1'/>
                        <div className='round round-2'/>
                        <div className='round round-3'/>
                    </div>
                </div>
            );
        }

        const postProps = {
            previousPostId: previousListId,
            shouldHighlight: Boolean(this.props.shouldHighlight),
            togglePostMenu: this.props.togglePostMenu,
            isLastPost: this.props.isLastPost,
        };

        if (PostListUtils.isCombinedUserActivityPost(listId)) {
            return (
                <CombinedUserActivityPost
                    location={Locations.CENTER}
                    combinedId={listId}
                    {...postProps}
                />
            );
        }

        return (
            <PostComponent
                post={this.props.post}
                location={Locations.CENTER}
                {...postProps}
            />
        );
    }
}
