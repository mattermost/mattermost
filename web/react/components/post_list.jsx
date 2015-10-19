// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Post = require('./post.jsx');
const UserProfile = require('./user_profile.jsx');
const AsyncClient = require('../utils/async_client.jsx');
const LoadingScreen = require('./loading_screen.jsx');

const PostStore = require('../stores/post_store.jsx');
const ChannelStore = require('../stores/channel_store.jsx');
const UserStore = require('../stores/user_store.jsx');
const SocketStore = require('../stores/socket_store.jsx');
const PreferenceStore = require('../stores/preference_store.jsx');

const utils = require('../utils/utils.jsx');
const Client = require('../utils/client.jsx');
const Constants = require('../utils/constants.jsx');
const ActionTypes = Constants.ActionTypes;
const SocketEvents = Constants.SocketEvents;

const AppDispatcher = require('../dispatcher/app_dispatcher.jsx');

export default class PostList extends React.Component {
    constructor(props) {
        super(props);

        this.gotMorePosts = false;
        this.scrolled = false;
        this.prevScrollTop = 0;
        this.seenNewMessages = false;
        this.isUserScroll = true;
        this.userHasSeenNew = false;
        this.loadInProgress = false;

        this.onChange = this.onChange.bind(this);
        this.onTimeChange = this.onTimeChange.bind(this);
        this.onSocketChange = this.onSocketChange.bind(this);
        this.createChannelIntroMessage = this.createChannelIntroMessage.bind(this);
        this.loadMorePosts = this.loadMorePosts.bind(this);
        this.loadFirstPosts = this.loadFirstPosts.bind(this);
        this.activate = this.activate.bind(this);
        this.deactivate = this.deactivate.bind(this);
        this.resize = this.resize.bind(this);

        const state = this.getStateFromStores(props.channelId);
        state.numToDisplay = Constants.POST_CHUNK_SIZE;
        state.isFirstLoadComplete = false;

        this.state = state;
    }
    getStateFromStores(id) {
        var postList = PostStore.getPosts(id);

        if (postList != null) {
            var deletedPosts = PostStore.getUnseenDeletedPosts(id);

            if (deletedPosts && Object.keys(deletedPosts).length > 0) {
                for (var pid in deletedPosts) {
                    if (deletedPosts.hasOwnProperty(pid)) {
                        postList.posts[pid] = deletedPosts[pid];
                        postList.order.unshift(pid);
                    }
                }

                postList.order.sort((a, b) => {
                    if (postList.posts[a].create_at > postList.posts[b].create_at) {
                        return -1;
                    }
                    if (postList.posts[a].create_at < postList.posts[b].create_at) {
                        return 1;
                    }
                    return 0;
                });
            }

            var pendingPostList = PostStore.getPendingPosts(id);

            if (pendingPostList) {
                postList.order = pendingPostList.order.concat(postList.order);
                for (var ppid in pendingPostList.posts) {
                    if (pendingPostList.posts.hasOwnProperty(ppid)) {
                        postList.posts[ppid] = pendingPostList.posts[ppid];
                    }
                }
            }
        }

        return {
            postList
        };
    }
    componentDidMount() {
        window.onload = () => this.scrollToBottom();
        if (this.props.isActive) {
            this.activate();
            this.loadFirstPosts(this.props.channelId);
        }
    }
    componentWillUnmount() {
        this.deactivate();
    }
    activate() {
        this.gotMorePosts = false;
        this.scrolled = false;
        this.prevScrollTop = 0;
        this.seenNewMessages = false;
        this.isUserScroll = true;
        this.userHasSeenNew = false;

        PostStore.clearUnseenDeletedPosts(this.props.channelId);
        PostStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onTimeChange);
        PreferenceStore.addChangeListener(this.onTimeChange);
        SocketStore.addChangeListener(this.onSocketChange);

        const postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));

        $(window).resize(() => {
            this.resize();
            if (!this.scrolled) {
                this.scrollToBottom();
            }
        });

        postHolder.on('scroll', () => {
            const position = postHolder.scrollTop() + postHolder.height() + 14;
            const bottom = postHolder[0].scrollHeight;

            if (position >= bottom) {
                this.scrolled = false;
            } else {
                this.scrolled = true;
            }

            if (this.isUserScroll) {
                this.userHasSeenNew = true;
            }
            this.isUserScroll = true;

            $('.top-visible-post').removeClass('top-visible-post');

            $(ReactDOM.findDOMNode(this.refs.postlistcontent)).children().each(function select() {
                if ($(this).position().top + $(this).height() / 2 > 0) {
                    $(this).addClass('top-visible-post');
                    return false;
                }
            });
        });

        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');

        if (!this.state.isFirstLoadComplete) {
            this.loadFirstPosts(this.props.channelId);
        }

        this.resize();
        this.onChange();
        this.scrollToBottom();
    }
    deactivate() {
        PostStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onTimeChange);
        SocketStore.removeChangeListener(this.onSocketChange);
        PreferenceStore.removeChangeListener(this.onTimeChange);
        $('body').off('click.userpopover');
        $(window).off('resize');
        var postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));
        postHolder.off('scroll');
    }
    componentDidUpdate(prevProps, prevState) {
        if (!this.props.isActive) {
            return;
        }

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

        if (this.props.isActive && !prevProps.isActive) {
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
            this.scrollToBottom(true);

        // the user clicked 'load more messages'
        } else if (this.gotMorePosts && oldOrder.length > 0) {
            let index;
            if (prevState.numToDisplay >= oldOrder.length) {
                index = oldOrder.length - 1;
            } else {
                index = prevState.numToDisplay;
            }
            const lastPost = oldPosts[oldOrder[index]];
            $('#post_' + lastPost.id)[0].scrollIntoView();
            this.gotMorePosts = false;
        } else {
            this.scrollTo(this.prevScrollTop);
        }
    }
    componentWillUpdate() {
        var postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));
        this.prevScrollTop = postHolder.scrollTop();
    }
    componentWillReceiveProps(nextProps) {
        if (nextProps.isActive === true && this.props.isActive === false) {
            this.activate();
        } else if (nextProps.isActive === false && this.props.isActive === true) {
            this.deactivate();
        }
    }
    resize() {
        const postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));
        if ($('#create_post').length > 0) {
            const height = $(window).height() - $('#create_post').height() - $('#error_bar').outerHeight() - 50;
            postHolder.css('height', height + 'px');
        }
    }
    scrollTo(val) {
        this.isUserScroll = false;
        var postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));
        postHolder[0].scrollTop = val;
    }
    scrollToBottom(force) {
        this.isUserScroll = false;
        var postHolder = $(ReactDOM.findDOMNode(this.refs.postlist));
        if ($('#new_message_' + this.props.channelId)[0] && !this.userHasSeenNew && !force) {
            $('#new_message_' + this.props.channelId)[0].scrollIntoView();
        } else {
            postHolder.addClass('hide-scroll');
            postHolder[0].scrollTop = postHolder[0].scrollHeight;
            postHolder.removeClass('hide-scroll');
        }
    }
    loadFirstPosts(id) {
        if (this.loadInProgress) {
            return;
        }

        if (this.props.channelId == null) {
            return;
        }

        this.loadInProgress = true;
        Client.getPosts(
            id,
            PostStore.getLatestUpdate(id),
            () => {
                this.loadInProgress = false;
                this.setState({isFirstLoadComplete: true});
            },
            () => {
                this.loadInProgress = false;
                this.setState({isFirstLoadComplete: true});
            }
        );
    }
    onChange() {
        var newState = this.getStateFromStores(this.props.channelId);

        if (!utils.areStatesEqual(newState.postList, this.state.postList)) {
            this.setState(newState);
        }
    }
    onSocketChange(msg) {
        if (msg.action === SocketEvents.POST_DELETED) {
            var activeRoot = $(document.activeElement).closest('.comment-create-body')[0];
            var activeRootPostId = '';
            if (activeRoot && activeRoot.id.length > 0) {
                activeRootPostId = activeRoot.id;
            }

            if (activeRootPostId === msg.props.post_id && UserStore.getCurrentId() !== msg.user_id) {
                $('#post_deleted').modal('show');
            }
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
                        {'This is the start of your direct message history with ' + teammateName + '.'}<br/>
                        {'Direct messages and files shared here are not shown to people outside this area.'}
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
                        <i className='fa fa-pencil'></i>{'Set a description'}
                    </a>
                </div>
            );
        }

        return (
            <div className='channel-intro'>
                <p className='channel-intro-text'>{'This is the start of your direct message history with this teammate. Direct messages and files shared here are not shown to people outside this area.'}</p>
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
                    This is the first channel teammates see when they sign up - use it for posting updates everyone needs to know.
                    <br/><br/>
                    To create a new channel or join an existing one, go to the Left Sidebar under “Channels” and click “More…”.
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

        var members = ChannelStore.getExtraInfo(channel.id).members;
        for (var i = 0; i < members.length; i++) {
            if (utils.isAdmin(members[i].roles)) {
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
        if (creatorName === '') {
            createMessage = 'This is the start of the ' + uiName + ' ' + uiType + ', created on ' + utils.displayDate(channel.create_at) + '.';
        } else {
            createMessage = (<span>This is the start of the <strong>{uiName}</strong> {uiType}, created by <strong>{creatorName}</strong> on <strong>{utils.displayDate(channel.create_at)}</strong></span>);
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
        var lastViewed = Number.MAX_VALUE;

        if (ChannelStore.getMember(this.props.channelId) != null) {
            lastViewed = ChannelStore.getMember(this.props.channelId).last_viewed_at;
        }

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

                // hide the profile pic if:
                //     the previous post was made by the same user as the current post,
                //     the previous post is not a comment,
                //     the current post is not a comment,
                //     the current post is not from a webhook
                //     and the previous post is not from a webhook
                if ((prevPost.user_id === post.user_id) &&
                        !utils.isComment(prevPost) &&
                        !utils.isComment(post) &&
                        (!post.props || !post.props.from_webhook) &&
                        (!prevPost.props || !prevPost.props.from_webhook)) {
                    hideProfilePic = true;
                }
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

            if (post.user_id !== userId && post.create_at > lastViewed && !renderedLastViewed) {
                renderedLastViewed = true;

                // Temporary fix to solve ie10/11 rendering issue
                let newSeparatorId = '';
                if (!utils.isBrowserIE()) {
                    newSeparatorId = 'new_message_' + this.props.channelId;
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
        var channelId = this.props.channelId;

        $(ReactDOM.findDOMNode(this.refs.loadmore)).text('Retrieving more messages...');

        Client.getPostsPage(
            channelId,
            order.length,
            Constants.POST_CHUNK_SIZE,
            function success(data) {
                $(ReactDOM.findDOMNode(this.refs.loadmore)).text('Load more messages');
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
                $(ReactDOM.findDOMNode(this.refs.loadmore)).text('Load more messages');
                AsyncClient.dispatchError(err, 'getPosts');
            }.bind(this)
        );
    }
    render() {
        var order = [];
        var posts;
        var channel = ChannelStore.get(this.props.channelId);

        if (this.state.postList != null) {
            posts = this.state.postList.posts;
            order = this.state.postList.order;
        }

        var moreMessages = <p className='beginning-messages-text'>Beginning of Channel</p>;
        if (channel != null) {
            if (order.length >= this.state.numToDisplay) {
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

        var activeClass = '';
        if (!this.props.isActive) {
            activeClass = 'inactive';
        }

        return (
            <div
                ref='postlist'
                className={'post-list-holder-by-time ' + activeClass}
            >
                <div className='post-list__table'>
                    <div
                        ref='postlistcontent'
                        className='post-list__content'
                    >
                        {moreMessages}
                        {postCtls}
                    </div>
                </div>
            </div>
        );
    }
}

PostList.defaultProps = {
    isActive: false,
    channelId: null
};
PostList.propTypes = {
    isActive: React.PropTypes.bool,
    channelId: React.PropTypes.string
};
