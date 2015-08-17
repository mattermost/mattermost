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

function getStateFromStores() {
    var channel = ChannelStore.getCurrent();

    if (channel == null) {
        channel = {};
    }

    var postList = PostStore.getCurrentPosts();
    var pendingPostList = PostStore.getPendingPosts(channel.id);

    if (pendingPostList) {
        postList.order = pendingPostList.order.concat(postList.order);
        for (var pid in pendingPostList.posts) {
            postList.posts[pid] = pendingPostList.posts[pid];
        }
    }

    return {
        postList: postList,
        channel: channel
    };
}

module.exports = React.createClass({
    displayName: 'PostList',
    scrollPosition: 0,
    preventScrollTrigger: false,
    gotMorePosts: false,
    oldScrollHeight: 0,
    oldZoom: 0,
    scrolledToNew: false,
    componentDidMount: function() {
        var user = UserStore.getCurrentUser();
        if (user.props && user.props.theme) {
            utils.changeCss('div.theme', 'background-color:' + user.props.theme + ';');
            utils.changeCss('.btn.btn-primary', 'background: ' + user.props.theme + ';');
            utils.changeCss('.modal .modal-header', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention-link', 'color: ' + user.props.theme + ';');
            utils.changeCss('@media(max-width: 768px){.search-bar__container', 'background: ' + user.props.theme + ';}');
            utils.changeCss('.search-item-container:hover', 'background: ' + utils.changeOpacity(user.props.theme, 0.05) + ';');
        }

        if (user.props.theme !== '#000000' && user.props.theme !== '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, -10) + ';');
            utils.changeCss('a.theme', 'color:' + user.props.theme + '; fill:' + user.props.theme + '!important;');
        } else if (user.props.theme === '#000000') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +50) + ';');
            $('.team__header').addClass('theme--black');
        } else if (user.props.theme === '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +10) + ';');
            $('.team__header').addClass('theme--gray');
        }

        PostStore.addChangeListener(this.onChange);
        ChannelStore.addChangeListener(this.onChange);
        UserStore.addStatusesChangeListener(this.onTimeChange);
        SocketStore.addChangeListener(this.onSocketChange);

        $('.post-list-holder-by-time').perfectScrollbar();

        this.resize();

        var postHolder = $('.post-list-holder-by-time')[0];
        this.scrollPosition = $(postHolder).scrollTop() + $(postHolder).innerHeight();
        this.oldScrollHeight = postHolder.scrollHeight;
        this.oldZoom = (window.outerWidth - 8) / window.innerWidth;

        $('.modal').on('show.bs.modal', function onShow() {
            $('.modal-body').css('overflow-y', 'auto');
            $('.modal-body').css('max-height', $(window).height() * 0.7);
        });

        // Timeout exists for the DOM to fully render before making changes
        var self = this;
        $(window).resize(function resize() {
            $(postHolder).perfectScrollbar('update');

            // this only kind of works, detecting zoom in browsers is a nightmare
            var newZoom = (window.outerWidth - 8) / window.innerWidth;

            if (self.scrollPosition >= postHolder.scrollHeight || (self.oldScrollHeight !== postHolder.scrollHeight && self.scrollPosition >= self.oldScrollHeight) || self.oldZoom !== newZoom) {
                self.resize();
            }

            self.oldZoom = newZoom;

            if ($('#create_post').length > 0) {
                var height = $(window).height() - $('#create_post').height() - $('#error_bar').outerHeight() - 50;
                $('.post-list-holder-by-time').css('height', height + 'px');
            }
        });

        $(postHolder).scroll(function scroll() {
            if (!self.preventScrollTrigger) {
                self.scrollPosition = $(postHolder).scrollTop() + $(postHolder).innerHeight();
            }
            self.preventScrollTrigger = false;
        });

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
    },
    componentDidUpdate: function() {
        this.resize();
        var postHolder = $('.post-list-holder-by-time')[0];
        this.scrollPosition = $(postHolder).scrollTop() + $(postHolder).innerHeight();
        this.oldScrollHeight = postHolder.scrollHeight;
        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');
    },
    componentWillUnmount: function() {
        PostStore.removeChangeListener(this.onChange);
        ChannelStore.removeChangeListener(this.onChange);
        UserStore.removeStatusesChangeListener(this.onTimeChange);
        SocketStore.removeChangeListener(this.onSocketChange);
        $('body').off('click.userpopover');
        $('.modal').off('show.bs.modal');
    },
    resize: function() {
        var postHolder = $('.post-list-holder-by-time')[0];
        this.preventScrollTrigger = true;
        if (this.gotMorePosts) {
            this.gotMorePosts = false;
            $(postHolder).scrollTop($(postHolder).scrollTop() + (postHolder.scrollHeight - this.oldScrollHeight));
        } else if ($('#new_message')[0] && !this.scrolledToNew) {
            $(postHolder).scrollTop($(postHolder).scrollTop() + $('#new_message').offset().top - 63);
            this.scrolledToNew = true;
        } else {
            $(postHolder).scrollTop(postHolder.scrollHeight);
        }
        $(postHolder).perfectScrollbar('update');
    },
    onChange: function() {
        var newState = getStateFromStores();

        if (!utils.areStatesEqual(newState, this.state)) {
            if (this.state.postList && this.state.postList.order) {
                if (this.state.channel.id === newState.channel.id && this.state.postList.order.length !== newState.postList.order.length && newState.postList.order.length > Constants.POST_CHUNK_SIZE) {
                    this.gotMorePosts = true;
                }
            }
            if (this.state.channel.id !== newState.channel.id) {
                this.scrolledToNew = false;
            }
            this.setState(newState);
        }
    },
    onSocketChange: function(msg) {
        var postList;
        var post;
        if (msg.action === 'posted') {
            post = JSON.parse(msg.props.post);
            PostStore.storePost(post);
        } else if (msg.action === 'post_edited') {
            if (this.state.channel.id === msg.channel_id) {
                this.setState({postList: postList});
            }

            PostStore.storePosts(post.channel_id, postList);
        } else if (msg.action === 'post_edited') {
            if (this.state.channel.id === msg.channel_id) {
                postList = this.state.postList;
                if (!(msg.props.post_id in postList.posts)) {
                    return;
                }

                post = postList.posts[msg.props.post_id];
                post.message = msg.props.message;

                postList.posts[post.id] = post;
                this.setState({postList: postList});

                PostStore.storePosts(msg.channel_id, postList);
            } else {
                AsyncClient.getPosts(true, msg.channel_id);
            }
        } else if (msg.action === 'post_deleted') {
            var activeRoot = $(document.activeElement).closest('.comment-create-body')[0];
            var activeRootPostId = '';
            if (activeRoot && activeRoot.id.length > 0) {
                activeRootPostId = activeRoot.id;
            }

            if (this.state.channel.id === msg.channel_id) {
                postList = this.state.postList;
                if (!(msg.props.post_id in this.state.postList.posts)) {
                    return;
                }

                delete postList.posts[msg.props.post_id];
                var index = postList.order.indexOf(msg.props.post_id);
                if (index > -1) {
                    postList.order.splice(index, 1);
                }

                this.setState({postList: postList});

                PostStore.storePosts(msg.channel_id, postList);
            } else {
                AsyncClient.getPosts(true, msg.channel_id);
            }

            if (activeRootPostId === msg.props.post_id && UserStore.getCurrentId() !== msg.user_id) {
                $('#post_deleted').modal('show');
            }
        } else if (msg.action === 'new_user') {
            AsyncClient.getProfiles();
        }
    },
    onTimeChange: function() {
        if (!this.state.postList) {
            return;
        }

        for (var id in this.state.postList.posts) {
            if (!this.refs[id]) {
                continue;
            }
            this.refs[id].forceUpdateInfo();
        }
    },
    getMorePosts: function(e) {
        e.preventDefault();

        if (!this.state.postList) {
            return;
        }

        var posts = this.state.postList.posts;
        var order = this.state.postList.order;
        var channelId = this.state.channel.id;

        $(this.refs.loadmore.getDOMNode()).text('Retrieving more messages...');

        var self = this;
        var currentPos = $('.post-list').scrollTop;

        Client.getPosts(
                channelId,
                order.length,
                Constants.POST_CHUNK_SIZE,
                function success(data) {
                    $(self.refs.loadmore.getDOMNode()).text('Load more messages');

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
                        postList: postList
                    });

                    Client.getProfiles();
                    $('.post-list').scrollTop(currentPos);
                },
                function fail(err) {
                    $(self.refs.loadmore.getDOMNode()).text('Load more messages');
                    AsyncClient.dispatchError(err, 'getPosts');
                }
            );
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var order = [];
        var posts;

        var lastViewed = Number.MAX_VALUE;

        if (ChannelStore.getCurrentMember() != null) {
            lastViewed = ChannelStore.getCurrentMember().lastViewed_at;
        }

        if (this.state.postList != null) {
            posts = this.state.postList.posts;
            order = this.state.postList.order;
        }

        var renderedLastViewed = false;

        var userId = '';
        if (UserStore.getCurrentId()) {
            userId = UserStore.getCurrentId();
        } else {
            return <div/>;
        }

        var channel = this.state.channel;

        var moreMessages = <p className='beginning-messages-text'>Beginning of Channel</p>;

        var userStyle = {color: UserStore.getCurrentUser().props.theme};

        if (channel != null) {
            if (order.length > 0 && order.length % Constants.POST_CHUNK_SIZE === 0) {
                moreMessages = <a ref='loadmore' className='more-messages-text theme' href='#' onClick={this.getMorePosts}>Load more messages</a>;
            } else if (channel.type === 'D') {
                var teammate = utils.getDirectTeammate(channel.id);

                if (teammate) {
                    var teammateName = teammate.username;
                    if (teammate.nickname.length > 0) {
                        teammateName = teammate.nickname;
                    }

                    moreMessages = (
                        <div className='channel-intro'>
                            <div className='post-profile-img__container channel-intro-img'>
                                <img className='post-profile-img' src={'/api/v1/users/' + teammate.id + '/image?time=' + teammate.update_at} height='50' width='50' />
                            </div>
                            <div className='channel-intro-profile'>
                                <strong><UserProfile userId={teammate.id} /></strong>
                            </div>
                            <p className='channel-intro-text'>
                                {'This is the start of your private message history with ' + teammateName + '.'}<br/>
                                {'Private messages and files shared here are not shown to people outside this area.'}
                            </p>
                            <a className='intro-links' href='#' style={userStyle} data-toggle='modal' data-target='#edit_channel' data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}><i className='fa fa-pencil'></i>Set a description</a>
                        </div>
                    );
                } else {
                    moreMessages = (
                        <div className='channel-intro'>
                            <p className='channel-intro-text'>{'This is the start of your private message history with this ' + strings.Team + 'mate. Private messages and files shared here are not shown to people outside this area.'}</p>
                        </div>
                    );
                }
            } else if (channel.type === 'P' || channel.type === 'O') {
                var uiName = channel.display_name;
                var members = ChannelStore.getCurrentExtraInfo().members;
                var creatorName = '';

                for (var i = 0; i < members.length; i++) {
                    if (members[i].roles.indexOf('admin') > -1) {
                        creatorName = members[i].username;
                        break;
                    }
                }

                if (ChannelStore.isDefault(channel)) {
                    moreMessages = (
                        <div className='channel-intro'>
                            <h4 className='channel-intro__title'>Beginning of {uiName}</h4>
                            <p className='channel-intro__content'>
                                Welcome to {uiName}!
                                <br/><br/>
                                {'This is the first channel ' + strings.Team + 'mates see when they'}
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
                } else if (channel.name === Constants.OFFTOPIC_CHANNEL) {
                    moreMessages = (
                        <div className='channel-intro'>
                            <h4 className='channel-intro__title'>Beginning of {uiName}</h4>
                            <p className='channel-intro__content'>
                                {'This is the start of ' + uiName + ', a channel for non-work-related conversations.'}
                                <br/>
                            </p>
                            <a className='intro-links' href='#' style={userStyle} data-toggle='modal' data-target='#edit_channel' data-desc={channel.description} data-title={uiName} data-channelid={channel.id}><i className='fa fa-pencil'></i>Set a description</a>
                        </div>
                    );
                } else {
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
                        createMessage = 'This is the start of the ' + uiName + ' ' + uiType + ', created by ' + creatorName + ' on ' + utils.displayDate(channel.create_at) + '.';
                    } else {
                        createMessage = 'This is the start of the ' + uiName + ' ' + uiType + ', created on ' + utils.displayDate(channel.create_at) + '.';
                    }

                    moreMessages = (
                        <div className='channel-intro'>
                            <h4 className='channel-intro__title'>Beginning of {uiName}</h4>
                            <p className='channel-intro__content'>
                                {createMessage}
                                {memberMessage}
                                <br/>
                            </p>
                            <a className='intro-links' href='#' style={userStyle} data-toggle='modal' data-target='#edit_channel' data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}><i className='fa fa-pencil'></i>Set a description</a>
                            <a className='intro-links' href='#' style={userStyle} data-toggle='modal' data-target='#channel_invite'><i className='fa fa-user-plus'></i>Invite others to this {uiType}</a>
                        </div>
                    );
                }
            }
        }

        var postCtls = [];

        if (posts) {
            var previousPostDay = new Date(0);
            var currentPostDay;

            for (var i = order.length - 1; i >= 0; i--) {
                var post = posts[order[i]];
                var parentPost = null;
                if (post.parent_id) {
                    parentPost = posts[post.parent_id];
                }

                var sameUser = '';
                var sameRoot = false;
                var hideProfilePic = false;
                var prevPost;
                if (i < order.length - 1) {
                    prevPost = posts[order[i + 1]];
                }

                if (prevPost) {
                    if ((prevPost.user_id === post.user_id) && (post.create_at - prevPost.create_at <= 1000 * 60 * 5)) {
                        sameUser = 'same--user';
                    }
                    sameRoot = utils.isComment(post) && (prevPost.id === post.root_id || prevPost.root_id === post.root_id);

                    // we only hide the profile pic if the previous post is not a comment, the current post is not a comment, and the previous post was made by the same user as the current post
                    hideProfilePic = (prevPost.user_id === post.user_id) && !utils.isComment(prevPost) && !utils.isComment(post);
                }

                // check if it's the last comment in a consecutive string of comments on the same post
                // it is the last comment if it is last post in the channel or the next post has a different root post
                var isLastComment = utils.isComment(post) && (i === 0 || posts[order[i - 1]].root_id !== post.root_id);

                var postCtl = (
                    <Post ref={post.id} sameUser={sameUser} sameRoot={sameRoot} post={post} parentPost={parentPost} key={post.id}
                        posts={posts} hideProfilePic={hideProfilePic} isLastComment={isLastComment}
                    />
                );

                currentPostDay = utils.getDateForUnixTicks(post.create_at);
                if (currentPostDay.toDateString() !== previousPostDay.toDateString()) {
                    postCtls.push(
                        <div key={currentPostDay.toDateString()} className='date-separator'>
                            <hr className='separator__hr' />
                            <div className='separator__text'>{currentPostDay.toDateString()}</div>
                        </div>
                    );
                }

                if (post.user_id !== userId && post.create_at > lastViewed && !renderedLastViewed) {
                    renderedLastViewed = true;
                    postCtls.push(
                        <div key='unviewed' className='new-separator'>
                            <hr id='new_message' className='separator__hr' />
                            <div className='separator__text'>New Messages</div>
                        </div>
                    );
                }
                postCtls.push(postCtl);
                previousPostDay = currentPostDay;
            }
        } else {
            postCtls.push(<LoadingScreen position='absolute' />);
        }

        return (
            <div ref='postlist' className='post-list-holder-by-time'>
                <div className='post-list__table'>
                    <div className='post-list__content'>
                        {moreMessages}
                        {postCtls}
                    </div>
                </div>
            </div>
        );
    }
});
