// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');
var UserProfile = require( './user_profile.jsx' );
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

    if (channel == null) channel = {};

    return {
        postList: PostStore.getCurrentPosts(),
        channel: channel
    };
}

module.exports = React.createClass({
    displayName: 'PostList',
    holdPosition: true,            // The default state is to hold your scroll position
                                    // This behavior should NOT be taken advantage of, always set this to the desired state

    scrollHeightFromBottom: 0,      // This represents the distance from the container's scrollHeight
                                    // and current scrollTop
                                    // Based on equation scrollTop + scrollHeightFromBottom = scrollHeight
    componentDidMount: function() {

        // Add CSS required to have the theme colors
        var user = UserStore.getCurrentUser();
        if (user.props && user.props.theme) {
            utils.changeCss('div.theme', 'background-color:' + user.props.theme + ';');
            utils.changeCss('.btn.btn-primary', 'background: ' + user.props.theme + ';');
            utils.changeCss('.modal .modal-header', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention', 'background: ' + user.props.theme + ';');
            utils.changeCss('.mention-link', 'color: ' + user.props.theme + ';');
            utils.changeCss('@media(max-width: 768px){.search-bar__container', 'background: ' + user.props.theme + ';}');
        }
        if (user.props.theme !== '#000000' && user.props.theme !== '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, -10) + ';');
            utils.changeCss('a.theme', 'color:' + user.props.theme + '; fill:' + user.props.theme + '!important;');
        } else if (user.props.theme === '#000000') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, 50) + ';');
            $('.team__header').addClass('theme--black');
        } else if (user.props.theme === '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, 10) + ';');
            $('.team__header').addClass('theme--gray');
        }

        // Start our Store listeners
        PostStore.addChangeListener(this.onListenerChange);
        ChannelStore.addChangeListener(this.onListenerChange);
        UserStore.addStatusesChangeListener(this.onTimeChange);
        SocketStore.addChangeListener(this.onSocketChange);

        // Timeout exists for the DOM to fully render before making changes
        var self = this;
        function initialScroll() {
            self.holdPosition = false;
            self.scrollWindow();
            $(document).off('DOMContentLoaded', initialScroll);
        }

        $(document).on('DOMContentLoaded', initialScroll);

        // Handle browser resizing
        $(window).resize(this.onResize);

        // Highlight stylingx
        $('body').on('click.userpopover', function(e){
            if ($(e.target).attr('data-toggle') !== 'popover' &&
                $(e.target).parents('.popover.in').length === 0) {
                $('.user-popover').popover('hide');
            }
        });

        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');

        $('body').on('mouseenter mouseleave', '.post', function(ev){
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.post.post--comment.same--root', function(ev){
            if (ev.type === 'mouseenter') {
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--comment');
            } else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--comment');
            }
        });
    },
    componentWillUpdate: function() {
        this.prepareScrollWindow();
    },
    componentDidUpdate: function() {
        this.scrollWindow();
        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');
    },
    componentWillUnmount: function() {
        PostStore.removeChangeListener(this.onListenerChange);
        ChannelStore.removeChangeListener(this.onListenerChange);
        UserStore.removeStatusesChangeListener(this.onTimeChange);
        SocketStore.removeChangeListener(this.onSocketChange);
        $('body').off('click.userpopover');
    },
    prepareScrollWindow: function() {
        var container = $('.post-list-holder-by-time');
        if (this.holdPosition) {
            this.scrollHeightFromBottom = container[0].scrollHeight - container.scrollTop();
        }
    },
    scrollWindow: function() {
        var container = $('.post-list-holder-by-time');

        // If there's a new message, jump the window to it
        // If there's no new message, we check if there is a scroll position to retrieve from the previous state
        // If we don't, then we just jump to the bottom
        if ($('#new_message').length) {
            container.scrollTop(container.scrollTop() + $('#new_message').offset().top - container.offset().top - $('.new-separator').height());
        } else if (this.holdPosition) {
            container.scrollTop(container[0].scrollHeight - this.scrollHeightFromBottom);
        } else {
            container.scrollTop(container[0].scrollHeight - container.innerHeight());
        }
        this.holdPosition = true;
    },
    onResize: function() {
        this.holdPosition = true;
        if ($('#create_post').length > 0) {
            var height = $(window).height() - $('#create_post').height() - $('#error_bar').outerHeight() - 50;
            $('.post-list-holder-by-time').css('height', height + 'px');
        }
        this.forceUpdate();
    },
    onListenerChange: function() {
        var newState = getStateFromStores();

        if (!utils.areStatesEqual(newState, this.state)) {
            this.holdPosition = (newState.channel.id === this.state.channel.id); // If we're on a new channel, go to the bottom, otherwise hold your position
            this.setState(newState);
        }
    },
    onSocketChange: function(msg) {
        var postList;
        var post;
        if (msg.action === 'posted') {
            post = JSON.parse(msg.props.post);

            postList = PostStore.getPosts(msg.channel_id);
            if (!postList) {
                return;
            }

            postList.posts[post.id] = post;
            if (postList.order.indexOf(post.id) === -1) {
                postList.order.unshift(post.id);
            }

            if (this.state.channel.id === msg.channel_id) {
                this.holdPosition = false;
                this.setState({postList: postList});
            } else {
                this.holdPosition = true;
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

                this.holdPosition = true;

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

                this.holdPosition = true;

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
        this.holdPosition = true;

        Client.getPosts(
                channelId,
                order.length,
                Constants.POST_CHUNK_SIZE,
                function(data) {
                    $(self.refs.loadmore.getDOMNode()).text('Load more messages');

                    if (!data) return;

                    if (data.order.length === 0) return;

                    var postList = {}
                    postList.posts = $.extend(posts, data.posts);
                    postList.order = order.concat(data.order);

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POSTS,
                        id: channelId,
                        postList: postList
                    });

                    Client.getProfiles();
                },
                function(err) {
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
            lastViewed = ChannelStore.getCurrentMember().last_viewed_at;
        }

        if (this.state.postList != null) {
            posts = this.state.postList.posts;
            order = this.state.postList.order;
        }

        var renderedLastViewed = false;

        var user_id = '';
        if (UserStore.getCurrentId()) {
            user_id = UserStore.getCurrentId();
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
                    var teammateName;
                    if (teammate.nickname.length > 0) {
                        teammateName = teammate.nickname;
                    } else {
                        teammateName = teammate.username;
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
                var createorName = '';

                for (var i = 0; i < members.length; i++) {
                    if (members[i].roles.indexOf('admin') > -1) {
                        createorName = members[i].username;
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
                    var permissions;
                    if (channel.type === 'P') {
                        uiType = 'private group';
                        permissions = ' Only invited members can see this private group.';
                    } else {
                        uiType = 'channel';
                        permissions = ' Any member can join and read this channel.';
                    }

                    var createorText;
                    if (createorName !== '') {
                        createorText = 'This is the start of the ' + uiName + ' ' + uiType + ', created by ' + createorName + ' on ' + utils.displayDate(channel.create_at) + '.';
                    } else {
                        createorText = 'This is the start of the ' + uiName + ' ' + uiType + ', created on '+ utils.displayDate(channel.create_at) + '.';
                    }
                    moreMessages = (
                        <div className='channel-intro'>
                            <h4 className='channel-intro__title'>Beginning of {uiName}</h4>
                            <p className='channel-intro__content'>
                                {createorText}
                                {permissions}
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

            for (var i = order.length-1; i >= 0; i--) {
                var post = posts[order[i]];
                var parentPost = null;
                if (post.parent_id) {
                    parentPost = posts[post.parent_id];
                }

                var sameUser = '';
                var sameRoot = false;
                var hideProfilePic = false;
                var prevPost = null;
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

                if (post.create_at > lastViewed && !renderedLastViewed) {
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
