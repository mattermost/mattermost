// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingScreen from 'components/loading_screen';
import {PostRequestTypes} from 'utils/constants';

import {getOldestPostId, getLatestPostId} from 'utils/post_utils';
import {clearMarks, mark, measure, trackEvent} from 'actions/telemetry_actions.jsx';

import VirtPostList from 'components/post_view/post_list_virtualized/post_list_virtualized';
import {updateNewMessagesAtInChannel} from 'actions/global_actions';
import type {LoadPostsParameters, LoadPostsReturnValue, CanLoadMorePosts} from 'actions/views/channel';

const MAX_NUMBER_OF_AUTO_RETRIES = 3;
export const MAX_EXTRA_PAGES_LOADED = 10;

// Measures the time between channel or team switch started and the post list component rendering posts.
// Set "fresh" to true when the posts have not been loaded before.
function markAndMeasureChannelSwitchEnd(fresh = false) {
    mark('PostList#component');

    const {duration: dur1, requestCount: requestCount1} = measure('SidebarChannelLink#click', 'PostList#component');
    const {duration: dur2, requestCount: requestCount2} = measure('TeamLink#click', 'PostList#component');

    clearMarks([
        'SidebarChannelLink#click',
        'TeamLink#click',
        'PostList#component',
    ]);

    if (dur1 !== -1) {
        trackEvent('performance', 'channel_switch', {
            duration: Math.round(dur1),
            fresh,
            requestCount: requestCount1,
        });
    }
    if (dur2 !== -1) {
        trackEvent('performance', 'team_switch', {
            duration: Math.round(dur2),
            fresh,
            requestCount: requestCount2,
        });
    }
}

export interface Props {

    /**
     *  Array of formatted post ids in the channel
     *  This will be different from postListIds because of grouping and filtering of posts
     *  This array should be used for making Before and After API calls
     */
    formattedPostIds?: string[];

    /**
     *  Array of post ids in the channel, ordered from newest to oldest
     */
    postListIds?: string[];

    /**
     * The channel the posts are in
     */
    channelId: string;

    /*
     * To get posts for perma view
     */
    focusedPostId?: string;

    /*
     * Used for determining if we are not at the recent most chunk in channel
     */
    atLatestPost: boolean;

    /*
     * Used for determining if we are at the channels oldest post
     */
    atOldestPost?: boolean;

    /*
     * Used for loading posts using unread API
     */
    isFirstLoad: boolean;

    /*
     * Used for syncing posts and is also passed down to virt list for newMessages indicator
     */
    latestPostTimeStamp?: number;

    /*
     * Used for passing down to virt list so it can change the chunk of posts selected
     */
    changeUnreadChunkTimeStamp: (lastViewedAt: number) => void;

    /*
     * Used for skipping the call on load
     */
    isPrefetchingInProcess: boolean;

    isMobileView: boolean;

    lastViewedAt: number;

    toggleShouldStartFromBottomWhenUnread: () => void;
    shouldStartFromBottomWhenUnread: boolean;
    hasInaccessiblePosts: boolean;

    actions: {

        /*
         * Used for getting permalink view posts
         */
        loadPostsAround: (channelId: string, focusedPostId: string) => Promise<void>;

        /*
         * Used for geting unreads posts
         */
        loadUnreads: (channelId: string) => Promise<void>;

        /*
         * Used for getting posts using BEFORE_ID and AFTER_ID
         */
        loadPosts: (parameters: LoadPostsParameters) => Promise<LoadPostsReturnValue>;

        /*
         * Used to loading posts since a timestamp to sync the posts
         */
        syncPostsInChannel: (channelId: string, since: number, prefetch: boolean) => Promise<void>;

        /*
         * Used to loading posts if it not first visit, permalink or there exists any postListIds
         * This happens when previous channel visit has a chunk which is not the latest set of posts
         */
        loadLatestPosts: (channelId: string) => Promise<void>;

        markChannelAsRead: (channelId: string) => void;
        updateNewMessagesAtInChannel: typeof updateNewMessagesAtInChannel;
    };
}

interface State {
    loadingNewerPosts: boolean;
    loadingOlderPosts: boolean;
    autoRetryEnable: boolean;
}

export default class PostList extends React.PureComponent<Props, State> {
    private autoRetriesCount: number;
    private actionsForPostList: {
        loadOlderPosts: () => Promise<void>;
        loadNewerPosts: () => Promise<void>;
        canLoadMorePosts: (type: CanLoadMorePosts) => Promise<void>;
        changeUnreadChunkTimeStamp: (lastViewedAt: number) => void;
        updateNewMessagesAtInChannel: typeof updateNewMessagesAtInChannel;
        toggleShouldStartFromBottomWhenUnread: () => void;
    };
    private mounted: boolean | undefined;

    // public for testing purposes only
    public extraPagesLoaded: number;

    constructor(props: Props) {
        super(props);
        this.state = {
            loadingNewerPosts: false,
            loadingOlderPosts: false,
            autoRetryEnable: true,
        };

        this.extraPagesLoaded = 0;

        this.autoRetriesCount = 0;
        this.actionsForPostList = {
            loadOlderPosts: this.getPostsBefore,
            loadNewerPosts: this.getPostsAfter,
            canLoadMorePosts: this.canLoadMorePosts,
            changeUnreadChunkTimeStamp: props.changeUnreadChunkTimeStamp,
            toggleShouldStartFromBottomWhenUnread: props.toggleShouldStartFromBottomWhenUnread,
            updateNewMessagesAtInChannel: this.props.actions.updateNewMessagesAtInChannel,
        };
    }

    componentDidMount() {
        this.mounted = true;
        if (this.props.channelId) {
            this.postsOnLoad(this.props.channelId);
            if (this.props.postListIds) {
                markAndMeasureChannelSwitchEnd();
            }
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.channelId !== prevProps.channelId) {
            this.postsOnLoad(this.props.channelId);
        }
        if (this.props.postListIds != null && prevProps.postListIds == null) {
            markAndMeasureChannelSwitchEnd(true);
        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    postsOnLoad = async (channelId: string) => {
        const {focusedPostId, isFirstLoad, latestPostTimeStamp, isPrefetchingInProcess, actions} = this.props;
        if (focusedPostId) {
            await actions.loadPostsAround(channelId, focusedPostId);
        } else if (isFirstLoad) {
            if (!isPrefetchingInProcess) {
                await actions.loadUnreads(channelId);
            }
        } else if (latestPostTimeStamp) {
            await actions.syncPostsInChannel(channelId, latestPostTimeStamp, false);
        } else {
            await actions.loadLatestPosts(channelId);
        }

        if (!focusedPostId) {
            // Posts are marked as read from here to not cause a race when loading posts
            // marking channel as read and viewed after calling for posts in channel
            this.props.actions.markChannelAsRead(channelId);
        }

        if (this.mounted) {
            this.setState({
                loadingOlderPosts: false,
                loadingNewerPosts: false,
            });
        }
    };

    callLoadPosts = async (channelId: string, postId: string, type: CanLoadMorePosts) => {
        const {error} = await this.props.actions.loadPosts({
            channelId,
            postId,
            type,
        });

        if (type === PostRequestTypes.BEFORE_ID) {
            this.setState({loadingOlderPosts: false});
        } else {
            this.setState({loadingNewerPosts: false});
        }

        if (error) {
            if (this.autoRetriesCount < MAX_NUMBER_OF_AUTO_RETRIES) {
                this.autoRetriesCount++;
                await this.callLoadPosts(channelId, postId, type);
            } else if (this.mounted) {
                this.setState({autoRetryEnable: false});
            }
        } else {
            if (this.mounted) {
                this.setState({autoRetryEnable: true});
            }

            if (!this.state.autoRetryEnable) {
                this.autoRetriesCount = 0;
            }
        }

        return {error};
    };

    getOldestVisiblePostId = () => {
        return getOldestPostId(this.props.postListIds || []);
    };

    getLatestVisiblePostId = () => {
        return getLatestPostId(this.props.postListIds || []);
    };

    canLoadMorePosts = async (type: CanLoadMorePosts = PostRequestTypes.BEFORE_ID) => {
        if (this.props.hasInaccessiblePosts) {
            return;
        }

        if (!this.props.postListIds) {
            return;
        }

        if (this.state.loadingOlderPosts || this.state.loadingNewerPosts) {
            return;
        }

        if (this.extraPagesLoaded > MAX_EXTRA_PAGES_LOADED) {
            // Prevent this from loading a lot of pages in a channel with only hidden messages
            // Enable load more messages manual link
            if (this.state.autoRetryEnable) {
                this.setState({autoRetryEnable: false});
            }
            return;
        }

        if (!this.props.atOldestPost && type === PostRequestTypes.BEFORE_ID) {
            await this.getPostsBefore();
        } else if (!this.props.atLatestPost) {
            // if all olderPosts are loaded load new ones
            await this.getPostsAfter();
        }

        this.extraPagesLoaded += 1;
    };

    getPostsBefore = async () => {
        if (this.state.loadingOlderPosts) {
            return;
        }

        // Reset counter after "Load more" button click
        if (!this.state.autoRetryEnable) {
            this.extraPagesLoaded = 0;
        }

        const oldestPostId = this.getOldestVisiblePostId();
        this.setState({loadingOlderPosts: true});
        await this.callLoadPosts(this.props.channelId, oldestPostId, PostRequestTypes.BEFORE_ID);
    };

    getPostsAfter = async () => {
        if (this.state.loadingNewerPosts) {
            return;
        }

        // Reset counter after "Load more" button click
        if (!this.state.autoRetryEnable) {
            this.extraPagesLoaded = 0;
        }

        const latestPostId = this.getLatestVisiblePostId();
        this.setState({loadingNewerPosts: true});
        await this.callLoadPosts(this.props.channelId, latestPostId, PostRequestTypes.AFTER_ID);
    };

    render() {
        if (!this.props.postListIds) {
            return (
                <LoadingScreen centered={true}/>
            );
        }

        return (
            <div
                className='post-list-holder-by-time'
                key={'postlist-' + this.props.channelId}
            >
                <div className='post-list__table'>
                    <div
                        id='virtualizedPostListContent'
                        className='post-list__content'
                    >
                        <VirtPostList
                            loadingNewerPosts={this.state.loadingNewerPosts}
                            loadingOlderPosts={this.state.loadingOlderPosts}
                            atOldestPost={this.props.atOldestPost}
                            atLatestPost={this.props.atLatestPost}
                            focusedPostId={this.props.focusedPostId}
                            channelId={this.props.channelId}
                            autoRetryEnable={this.state.autoRetryEnable}
                            shouldStartFromBottomWhenUnread={this.props.shouldStartFromBottomWhenUnread}
                            actions={this.actionsForPostList}
                            postListIds={this.props.formattedPostIds}
                            latestPostTimeStamp={this.props.latestPostTimeStamp}
                            isMobileView={this.props.isMobileView}
                            lastViewedAt={this.props.lastViewedAt}
                        />
                    </div>
                </div>
            </div>
        );
    }
}
