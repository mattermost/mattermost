// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var UserProfile = require('./user_profile.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var Post = require('./post.jsx');
var LoadingScreen = require('./loading_screen.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var utils = require('../utils/utils.jsx');
var Client = require('../utils/client.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var Constants = require('../utils/constants.jsx');
var ActionTypes = Constants.ActionTypes;

import {strings} from '../utils/config.js';

export default class PostList extends React.Component {
    constructor() {
        super();

        this.gotMorePosts = false;
        this.scrolled = false;
        this.prevScrollTop = 0;
        this.seenNewMessages = false;
        this.isUserScroll = true;
        this.userHasSeenNew = false;

        this.onChange = this.onChange.bind(this);
        this.onTimeChange = this.onTimeChange.bind(this);
        this.onSocketChange = this.onSocketChange.bind(this);
        this.createChannelIntroMessage = this.createChannelIntroMessage.bind(this);
        this.loadMorePosts = this.loadMorePosts.bind(this);
        this.loadFirstPosts = this.loadFirstPosts.bind(this);

        this.state = this.getStateFromStores();
        this.state.numToDisplay = Constants.POST_CHUNK_SIZE;
        this.state.isFirstLoadComplete = false;
    }
    getStateFromStores() {
        var channel = ChannelStore.getCurrent();

        if (channel == null) {
            channel = {};
        }

        var postList = PostStore.getCurrentPosts();

        if (postList != null) {
            var deletedPosts = PostStore.getUnseenDeletedPosts(channel.id);

            if (deletedPosts && Object.keys(deletedPosts).length > 0) {
                for (var pid in deletedPosts) {
                    if (deletedPosts.hasOwnProperty(pid)) {
                        postList.posts[pid] = deletedPosts[pid];
                        postList.order.unshift(pid);
                    }
                }

                postList.order.sort(function postSort(a, b) {
                    if (postList.posts[a].create_at > postList.posts[b].create_at) {
                        return -1;
                    }
                    if (postList.posts[a].create_at < postList.posts[b].create_at) {
                        return 1;
                    }
                    return 0;
                });
            }

            var pendingPostList = PostStore.getPendingPosts(channel.id);

            if (pendingPostList) {
                postList.order = pendingPostList.order.concat(postList.order);
                for (var ppid in pendingPostList.posts) {
                    if (pendingPostList.posts.hasOwnProperty(ppid)) {
                        postList.posts[ppid] = pendingPostList.posts[ppid];
                    }
                }
            }
        }

        var lastViewed = Number.MAX_VALUE;

        if (ChannelStore.getCurrentMember() != null) {
            lastViewed = ChannelStore.getCurrentMember().last_viewed_at;
        }

        return {
            postList: postList,
            channel: channel,
            lastViewed: lastViewed
        };
    }
    componentDidMount() {
        PostStore.addChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onTimeChange);
        SocketStore.addChangeListener(this.onSocketChange);

        var postHolder = $('.post-list-holder-by-time');

        $('.modal').on('show.bs.modal', function onShow() {
            $('.modal-body').css('overflow-y', 'auto');
            $('.modal-body').css('max-height', $(window).height() * 0.7);
        });

        $(window).resize(function resize() {
            if ($('#create_post').length > 0) {
                var height = $(window).height() - $('#create_post').height() - $('#error_bar').outerHeight() - 50;
                postHolder.css('height', height + 'px');
            }

            if (!this.scrolled) {
                this.scrollToBottom();
            }
        }.bind(this));

        postHolder.scroll(function scroll() {
            var position = postHolder.scrollTop() + postHolder.height() + 14;
            var bottom = postHolder[0].scrollHeight;

            if (position >= bottom) {
                this.scrolled = false;
            } else {
                this.scrolled = true;
            }

            if (this.isUserScroll) {
                this.userHasSeenNew = true;
            }
            this.isUserScroll = true;
        }.bind(this));

        $('body').on('click.userpopover', function popOver(e) {
            if ($(e.target).attr('data-toggle') !== 'popover' &&
                $(e.target).parents('.popover.in').length === 0) {
                $('.user-popover').popover('hide');
            }
        });

        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');

        $('body').on('mouseenter mouseleave', '.post', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.post.post--comment.same--root', function mouseOver(ev) {
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--comment');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--comment');
            }
        });

        this.scrollToBottom();

        if (this.state.channel.id != null) {
            this.loadFirstPosts(this.state.channel.id);
        }
    }
    componentDidUpdate(prevProps, prevState) {
        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');

        if (this.state.postList == null || prevState.postList == null) {
            this.scrollToBottom();
            return;
        }

        var order = this.state.postList.order || [];
        var posts = this.state.postList.posts || {};
        var oldOrder = prevState.postList.order || [];
        var oldPosts = prevState.postList.posts || {};
        var userId = UserStore.getCurrentId();
        var firstPost = posts[order[0]] || {};
        var isNewPost = oldOrder.indexOf(order[0]) === -1;

        if (this.state.channel.id !== prevState.channel.id) {
            this.scrollToBottom();
        } else if (oldOrder.length === 0) {
            this.scrollToBottom();

        // the user is scrolled to the bottom
        } else if (!this.scrolled) {
            this.scrollToBottom();

        // there's a new post and
        // it's by the user and not a comment
        } else if (isNewPost &&
                    userId === firstPost.user_id &&
                    !utils.isComment(firstPost)) {
            this.state.lastViewed = utils.getTimestamp();
            this.scrollToBottom(true);

        // the user clicked 'load more messages'
        } else if (this.gotMorePosts) {
            var lastPost = oldPosts[oldOrder[prevState.numToDisplay]];
            $('#' + lastPost.id)[0].scrollIntoView();
        } else {
            this.scrollTo(this.prevScrollTop);
        }
    }
    componentWillUpdate() {
        var postHolder = $('.post-list-holder-by-time');
        this.prevScrollTop = postHolder.scrollTop();
    }
    componentWillUnmount() {
        PostStore.removeChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onTimeChange);
        SocketStore.removeChangeListener(this.onSocketChange);
        $('body').off('click.userpopover');
        $('.modal').off('show.bs.modal');
    }
    scrollTo(val) {
        this.isUserScroll = false;
        var postHolder = $('.post-list-holder-by-time');
        postHolder[0].scrollTop = val;
    }
    scrollToBottom(force) {
        this.isUserScroll = false;
        var postHolder = $('.post-list-holder-by-time');
        if ($('#new_message')[0] && !this.userHasSeenNew && !force) {
            $('#new_message')[0].scrollIntoView();
        } else {
            postHolder.addClass('hide-scroll');
            postHolder[0].scrollTop = postHolder[0].scrollHeight;
            postHolder.removeClass('hide-scroll');
        }
    }
    loadFirstPosts(id) {
        Client.getPosts(
            id,
            PostStore.getLatestUpdate(id),
            function success() {
                this.setState({isFirstLoadComplete: true});
            }.bind(this),
            function fail() {
                this.setState({isFirstLoadComplete: true});
            }.bind(this)
        );
    }
    onChange() {
        var newState = this.getStateFromStores();

        // Special case where the channel wasn't yet set in componentDidMount
        if (!this.state.isFirstLoadComplete && this.state.channel.id == null && newState.channel.id != null) {
            this.loadFirstPosts(newState.channel.id);
        }

        if (!utils.areStatesEqual(newState, this.state)) {
            if (this.state.channel.id !== newState.channel.id) {
                PostStore.clearUnseenDeletedPosts(this.state.channel.id);
                this.userHasSeenNew = false;
                newState.numToDisplay = Constants.POST_CHUNK_SIZE;
            } else {
                newState.lastViewed = this.state.lastViewed;
            }

            this.setState(newState);
        }
    }
    onSocketChange(msg) {
        var post;
        if (msg.action === 'posted' || msg.action === 'post_edited') {
            post = JSON.parse(msg.props.post);
            PostStore.storePost(post);
        } else if (msg.action === 'post_deleted') {
            var activeRoot = $(document.activeElement).closest('.comment-create-body')[0];
            var activeRootPostId = '';
            if (activeRoot && activeRoot.id.length > 0) {
                activeRootPostId = activeRoot.id;
            }

            post = JSON.parse(msg.props.post);

            PostStore.storeUnseenDeletedPost(post);
            PostStore.removePost(post, true);
            PostStore.emitChange();

            if (activeRootPostId === msg.props.post_id && UserStore.getCurrentId() !== msg.user_id) {
                $('#post_deleted').modal('show');
            }
        } else if (msg.action === 'new_user') {
            AsyncClient.getProfiles();
        }
    }
    onTimeChange() {
        if (!this.state.postList) {
            return;
        }

        for (var id in this.state.postList.posts) {
            if (!this.refs[id]) {
                continue;
            }
            this.refs[id].forceUpdateInfo();
        }
    }
    createDMIntroMessage(channel) {
        var teammate = utils.getDirectTeammate(channel.id);

        if (teammate) {
            var teammateName = teammate.username;
            if (teammate.nickname.length > 0) {
                teammateName = teammate.nickname;
            }

            return (
                <div className='channel-intro'>
                    <div className='post-profile-img__container channel-intro-img'>
                        <img
                            className='post-profile-img'
                            src={'/api/v1/users/' + teammate.id + '/image?time=' + teammate.update_at}
                            height='50'
                            width='50'
                        />
                    </div>
                    <div className='channel-intro-profile'>
                        <strong><UserProfile userId={teammate.id} /></strong>
                    </div>
                    <p className='channel-intro-text'>
                        {'This is the start of your private message history with ' + teammateName + '.'}<br/>
                        {'Private messages and files shared here are not shown to people outside this area.'}
                    </p>
                    <a
                        className='intro-links'
                        href='#'
                        data-toggle='modal'
                        data-target='#edit_channel'
                        data-desc={channel.description}
                        data-title={channel.display_name}
                        data-channelid={channel.id}
                    >
                        <i className='fa fa-pencil'></i>Set a description
                    </a>
                </div>
            );
        }

        return (
            <div className='channel-intro'>
                <p className='channel-intro-text'>{'This is the start of your private message history with this ' + strings.Team + 'mate. Private messages and files shared here are not shown to people outside this area.'}</p>
            </div>
        );
    }
    createChannelIntroMessage(channel) {
        if (channel.type === 'D') {
            return this.createDMIntroMessage(channel);
        } else if (ChannelStore.isDefault(channel)) {
            return this.createDefaultIntroMessage(channel);
        } else if (channel.name === Constants.OFFTOPIC_CHANNEL) {
            return this.createOffTopicIntroMessage(channel);
        } else if (channel.type === 'O' || channel.type === 'P') {
            return this.createStandardIntroMessage(channel);
        }
    }
    createDefaultIntroMessage(channel) {
        return (
            <div className='channel-intro'>
                <h4 className='channel-intro__title'>Beginning of {channel.display_name}</h4>
                <p className='channel-intro__content'>
                    Welcome to {channel.display_name}!
                    <br/><br/>
                    This is the first channel {strings.Team}mates see when they
                    <br/>
                    sign up - use it for posting updates everyone needs to know.
                    <br/><br/>
                    To create a new channel or join an existing one, go to
                    <br/>
                    the Left Hand Sidebar under “Channels” and click “More…”.
                    <br/>
                </p>
            </div>
        );
    }
    createOffTopicIntroMessage(channel) {
        return (
            <div className='channel-intro'>
                <h4 className='channel-intro__title'>Beginning of {channel.display_name}</h4>
                <p className='channel-intro__content'>
                    {'This is the start of ' + channel.display_name + ', a channel for non-work-related conversations.'}
                    <br/>
                </p>
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#edit_channel'
                    data-desc={channel.description}
                    data-title={channel.display_name}
                    data-channelid={channel.id}
                >
                    <i className='fa fa-pencil'></i>Set a description
                </a>
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#channel_invite'
                >
                    <i className='fa fa-user-plus'></i>Invite others to this channel
                </a>
            </div>
        );
    }
    getChannelCreator(channel) {
        if (channel.creator_id.length > 0) {
            var creator = UserStore.getProfile(channel.creator_id);
            if (creator) {
                return creator.username;
            }
        }

        var members = ChannelStore.getCurrentExtraInfo().members;
        for (var i = 0; i < members.length; i++) {
            if (members[i].roles.indexOf('admin') > -1) {
                return members[i].username;
            }
        }
    }
    createStandardIntroMessage(channel) {
        var uiName = channel.display_name;
        var creatorName = '';

        var uiType;
        var memberMessage;
        if (channel.type === 'P') {
            uiType = 'private group';
            memberMessage = ' Only invited members can see this private group.';
        } else {
            uiType = 'channel';
            memberMessage = ' Any member can join and read this channel.';
        }

        var createMessage;
        if (creatorName !== '') {
            createMessage = (<span>This is the start of the <strong>{uiName}</strong> {uiType}, created by <strong>{creatorName}</strong> on <strong>{utils.displayDate(channel.create_at)}</strong></span>);
        } else {
            createMessage = 'This is the start of the ' + uiName + ' ' + uiType + ', created on ' + utils.displayDate(channel.create_at) + '.';
        }

        return (
            <div className='channel-intro'>
                <h4 className='channel-intro__title'>Beginning of {uiName}</h4>
                <p className='channel-intro__content'>
                    {createMessage}
                    {memberMessage}
                    <br/>
                </p>
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#edit_channel'
                    data-desc={channel.description}
                    data-title={channel.display_name}
                    data-channelid={channel.id}
                >
                    <i className='fa fa-pencil'></i>Set a description
                </a>
                <a
                    className='intro-links'
                    href='#'
                    data-toggle='modal'
                    data-target='#channel_invite'
                >
                    <i className='fa fa-user-plus'></i>Invite others to this {uiType}
                </a>
            </div>
        );
    }
    createPosts(posts, order) {
        var postCtls = [];
        var previousPostDay = new Date(0);
        var userId = UserStore.getCurrentId();

        var renderedLastViewed = false;

        var numToDisplay = this.state.numToDisplay;
        if (order.length - 1 < numToDisplay) {
            numToDisplay = order.length - 1;
        }

        for (var i = numToDisplay; i >= 0; i--) {
            var post = posts[order[i]];
            var parentPost = posts[post.parent_id];

            var sameUser = false;
            var sameRoot = false;
            var hideProfilePic = false;
            var prevPost = posts[order[i + 1]];

            if (prevPost) {
                sameUser = prevPost.user_id === post.user_id && post.create_at - prevPost.create_at <= 1000 * 60 * 5;

                sameRoot = utils.isComment(post) && (prevPost.id === post.root_id || prevPost.root_id === post.root_id);

                // we only hide the profile pic if the previous post is not a comment, the current post is not a comment, and the previous post was made by the same user as the current post
                hideProfilePic = (prevPost.user_id === post.user_id) && !utils.isComment(prevPost) && !utils.isComment(post);
            }

            // check if it's the last comment in a consecutive string of comments on the same post
            // it is the last comment if it is last post in the channel or the next post has a different root post
            var isLastComment = utils.isComment(post) && (i === 0 || posts[order[i - 1]].root_id !== post.root_id);

            var postCtl = (
                <Post
                    key={post.id + 'postKey'}
                    ref={post.id}
                    sameUser={sameUser}
                    sameRoot={sameRoot}
                    post={post}
                    parentPost={parentPost}
                    posts={posts}
                    hideProfilePic={hideProfilePic}
                    isLastComment={isLastComment}
                />
            );

            let currentPostDay = utils.getDateForUnixTicks(post.create_at);
            if (currentPostDay.toDateString() !== previousPostDay.toDateString()) {
                postCtls.push(
                    <div
                        key={currentPostDay.toDateString()}
                        className='date-separator'
                    >
                        <hr className='separator__hr' />
                        <div className='separator__text'>{currentPostDay.toDateString()}</div>
                    </div>
                );
            }

            if (post.user_id !== userId && post.create_at > this.state.lastViewed && !renderedLastViewed) {
                renderedLastViewed = true;

                // Temporary fix to solve ie10/11 rendering issue
                let newSeparatorId = '';
                if (!utils.isBrowserIE()) {
                    newSeparatorId = 'new_message';
                }
                postCtls.push(
                    <div
                        id={newSeparatorId}
                        key='unviewed'
                        className='new-separator'
                    >
                        <hr
                            className='separator__hr'
                        />
                        <div className='separator__text'>New Messages</div>
                    </div>
                );
            }
            postCtls.push(postCtl);
            previousPostDay = currentPostDay;
        }

        return postCtls;
    }
    loadMorePosts() {
        if (this.state.postList == null) {
            return;
        }

        var posts = this.state.postList.posts;
        var order = this.state.postList.order;
        var channelId = this.state.channel.id;

        $(React.findDOMNode(this.refs.loadmore)).text('Retrieving more messages...');

        Client.getPostsPage(
            channelId,
            order.length,
            Constants.POST_CHUNK_SIZE,
            function success(data) {
                $(React.findDOMNode(this.refs.loadmore)).text('Load more messages');
                this.gotMorePosts = true;
                this.setState({numToDisplay: this.state.numToDisplay + Constants.POST_CHUNK_SIZE});

                if (!data) {
                    return;
                }

                if (data.order.length === 0) {
                    return;
                }

                var postList = {};
                postList.posts = $.extend(posts, data.posts);
                postList.order = order.concat(data.order);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POSTS,
                    id: channelId,
                    post_list: postList
                });

                Client.getProfiles();
            }.bind(this),
            function fail(err) {
                $(React.findDOMNode(this.refs.loadmore)).text('Load more messages');
                AsyncClient.dispatchError(err, 'getPosts');
            }.bind(this)
        );
    }
    render() {
        var order = [];
        var posts;
        var channel = this.state.channel;

        if (this.state.postList != null) {
            posts = this.state.postList.posts;
            order = this.state.postList.order;
        }

        var moreMessages = <p className='beginning-messages-text'>Beginning of Channel</p>;
        if (channel != null) {
            if (order.length > this.state.numToDisplay) {
                moreMessages = (
                    <a
                        ref='loadmore'
                        className='more-messages-text theme'
                        href='#'
                        onClick={this.loadMorePosts}
                    >
                            Load more messages
                    </a>
                );
            } else {
                moreMessages = this.createChannelIntroMessage(channel);
            }
        }

        var postCtls = [];
        if (posts && this.state.isFirstLoadComplete) {
            postCtls = this.createPosts(posts, order);
        } else {
            postCtls.push(
                <LoadingScreen
                    position='absolute'
                    key='loading'
                />);
        }

        return (
            <div
                ref='postlist'
                className='post-list-holder-by-time'
            >
                <div className='post-list__table'>
                    <div className='post-list__content'>
                        {moreMessages}
                        {postCtls}
                    </div>
                </div>
            </div>
        );
    }
}
