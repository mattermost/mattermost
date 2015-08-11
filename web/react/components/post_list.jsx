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
        post_list: PostStore.getCurrentPosts(),
        channel: channel
    };
}

module.exports = React.createClass({
    displayName: "PostList",
    scrollPosition: 0,
    preventScrollTrigger: false,
    gotMorePosts: false,
    oldScrollHeight: 0,
    oldZoom: 0,
    scrolledToNew: false,
    componentDidMount: function() {
        var user = UserStore.getCurrentUser();
        if (user.props && user.props.theme) {
            utils.changeCss('div.theme', 'background-color:'+user.props.theme+';');
            utils.changeCss('.btn.btn-primary', 'background: ' + user.props.theme+';');
            utils.changeCss('.modal .modal-header', 'background: ' + user.props.theme+';');
            utils.changeCss('.mention', 'background: ' + user.props.theme+';');
            utils.changeCss('.mention-link', 'color: ' + user.props.theme+';');
            utils.changeCss('@media(max-width: 768px){.search-bar__container', 'background: ' + user.props.theme+';}');
        }
        if (user.props.theme != '#000000' && user.props.theme != '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, -10)  +';');
            utils.changeCss('a.theme', 'color:'+user.props.theme+'; fill:'+user.props.theme+'!important;');
        } else if (user.props.theme == '#000000') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +50)  +';');
            $('.team__header').addClass('theme--black');
        } else if (user.props.theme == '#585858') {
            utils.changeCss('.btn.btn-primary:hover, .btn.btn-primary:active, .btn.btn-primary:focus', 'background: ' + utils.changeColor(user.props.theme, +10)  +';');
            $('.team__header').addClass('theme--gray');
        }

        PostStore.addChangeListener(this._onChange);
        ChannelStore.addChangeListener(this._onChange);
        UserStore.addStatusesChangeListener(this._onTimeChange);
        SocketStore.addChangeListener(this._onSocketChange);

        $(".post-list-holder-by-time").perfectScrollbar();

        this.resize();

        var post_holder = $(".post-list-holder-by-time")[0];
        this.scrollPosition = $(post_holder).scrollTop() + $(post_holder).innerHeight();
        this.oldScrollHeight = post_holder.scrollHeight;
        this.oldZoom = (window.outerWidth - 8) / window.innerWidth;

        var self = this;
        $(window).resize(function(){
            $(post_holder).perfectScrollbar('update');

            // this only kind of works, detecting zoom in browsers is a nightmare
            var newZoom = (window.outerWidth - 8) / window.innerWidth;

            if (self.scrollPosition >= post_holder.scrollHeight || (self.oldScrollHeight != post_holder.scrollHeight && self.scrollPosition >= self.oldScrollHeight) || self.oldZoom != newZoom) self.resize();

            self.oldZoom = newZoom;

            if ($('#create_post').length > 0) {
                var height = $(window).height() - $('#create_post').height() - $('#error_bar').outerHeight() - 50;
                $(".post-list-holder-by-time").css("height", height + "px");
            }
        });

        $(post_holder).scroll(function(e){
            if (!self.preventScrollTrigger) {
                self.scrollPosition = $(post_holder).scrollTop() + $(post_holder).innerHeight();
            }
            self.preventScrollTrigger = false;
        });

        $('body').on('click.userpopover', function(e){
            if ($(e.target).attr('data-toggle') !== 'popover'
                && $(e.target).parents('.popover.in').length === 0) {
                $('.user-popover').popover('hide');
            }
        });

        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');

        $('body').on('mouseenter mouseleave', '.post', function(ev){
            if(ev.type === 'mouseenter'){
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--before');
            }
            else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--after');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--before');
            }
        });

        $('body').on('mouseenter mouseleave', '.post.post--comment.same--root', function(ev){
            if(ev.type === 'mouseenter'){
                $(this).parent('div').prev('.date-separator, .new-separator').addClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').addClass('hovered--comment');
            }
            else {
                $(this).parent('div').prev('.date-separator, .new-separator').removeClass('hovered--comment');
                $(this).parent('div').next('.date-separator, .new-separator').removeClass('hovered--comment');
            }
        });

    },
    componentDidUpdate: function() {
        this.resize();
        var post_holder = $(".post-list-holder-by-time")[0];
        this.scrollPosition = $(post_holder).scrollTop() + $(post_holder).innerHeight();
        this.oldScrollHeight = post_holder.scrollHeight;
        $('.post-list__content div .post').removeClass('post--last');
        $('.post-list__content div:last-child .post').addClass('post--last');
    },
    componentWillUnmount: function() {
        PostStore.removeChangeListener(this._onChange);
        ChannelStore.removeChangeListener(this._onChange);
        UserStore.removeStatusesChangeListener(this._onTimeChange);
        SocketStore.removeChangeListener(this._onSocketChange);
        $('body').off('click.userpopover');
    },
    resize: function() {
        var post_holder = $(".post-list-holder-by-time")[0];
        this.preventScrollTrigger = true;
        if (this.gotMorePosts) {
            this.gotMorePosts = false;
            $(post_holder).scrollTop($(post_holder).scrollTop() + (post_holder.scrollHeight-this.oldScrollHeight) );
        } else {
            if ($("#new_message")[0] && !this.scrolledToNew) {
                $(post_holder).scrollTop($(post_holder).scrollTop() + $("#new_message").offset().top - 63);
                this.scrolledToNew = true;
            } else {
                $(post_holder).scrollTop(post_holder.scrollHeight);
            }
        }
        $(post_holder).perfectScrollbar('update');
    },
    _onChange: function() {
        var newState = getStateFromStores();

        if (!utils.areStatesEqual(newState, this.state)) {
            if (this.state.post_list && this.state.post_list.order) {
                if (this.state.channel.id === newState.channel.id && this.state.post_list.order.length != newState.post_list.order.length && newState.post_list.order.length > Constants.POST_CHUNK_SIZE) {
                    this.gotMorePosts = true;
                }
            }
            if (this.state.channel.id !== newState.channel.id) {
                this.scrolledToNew = false;
            }
            this.setState(newState);
        }
    },
    _onSocketChange: function(msg) {
        if (msg.action == "posted") {
            var post = JSON.parse(msg.props.post);

            var post_list = PostStore.getPosts(msg.channel_id);
            if (!post_list) return;

            post_list.posts[post.id] = post;
            if (post_list.order.indexOf(post.id) === -1) {
                post_list.order.unshift(post.id);
            }

            if (this.state.channel.id === msg.channel_id) {
                this.setState({ post_list: post_list });
            };

            PostStore.storePosts(post.channel_id, post_list);
        } else if (msg.action == "post_edited") {
            if (this.state.channel.id == msg.channel_id) {
                var post_list = this.state.post_list;
                if (!(msg.props.post_id in post_list.posts)) return;

                var post = post_list.posts[msg.props.post_id];
                post.message = msg.props.message;

                post_list.posts[post.id] = post;
                this.setState({ post_list: post_list });

                PostStore.storePosts(msg.channel_id, post_list);
            } else {
                AsyncClient.getPosts(true, msg.channel_id);
            }
        } else if (msg.action == "post_deleted") {
            var activeRoot = $(document.activeElement).closest('.comment-create-body')[0];
            var activeRootPostId = activeRoot && activeRoot.id.length > 0 ? activeRoot.id : "";

            if (this.state.channel.id == msg.channel_id) {
                var post_list = this.state.post_list;
                if (!(msg.props.post_id in this.state.post_list.posts)) return;

                delete post_list.posts[msg.props.post_id];
                var index = post_list.order.indexOf(msg.props.post_id);
                if (index > -1) post_list.order.splice(index, 1);

                this.setState({ post_list: post_list });

                PostStore.storePosts(msg.channel_id, post_list);
            } else {
                AsyncClient.getPosts(true, msg.channel_id);
            }

            if (activeRootPostId === msg.props.post_id && UserStore.getCurrentId() != msg.user_id) {
                $('#post_deleted').modal('show');
            }
        } else if (msg.action == "new_user") {
            AsyncClient.getProfiles();
        }
    },
    _onTimeChange: function() {
        if (!this.state.post_list) return;
        for (var id in this.state.post_list.posts) {
            if (!this.refs[id]) continue;
            this.refs[id].forceUpdateInfo();
        }
    },
    getMorePosts: function(e) {
        e.preventDefault();

        if (!this.state.post_list) return;

        var posts = this.state.post_list.posts;
        var order = this.state.post_list.order;
        var channel_id = this.state.channel.id;

        $(this.refs.loadmore.getDOMNode()).text("Retrieving more messages...");

        var self = this;
        var currentPos = $(".post-list").scrollTop;

        Client.getPosts(
                channel_id,
                order.length,
                Constants.POST_CHUNK_SIZE,
                function(data) {
                    $(self.refs.loadmore.getDOMNode()).text("Load more messages");

                    if (!data) return;

                    if (data.order.length === 0) return;

                    var post_list = {}
                    post_list.posts = $.extend(posts, data.posts);
                    post_list.order = order.concat(data.order);

                    AppDispatcher.handleServerAction({
                        type: ActionTypes.RECIEVED_POSTS,
                        id: channel_id,
                        post_list: post_list
                    });

                    Client.getProfiles();
                    $(".post-list").scrollTop(currentPos);
                },
                function(err) {
                    $(self.refs.loadmore.getDOMNode()).text("Load more messages");
                    AsyncClient.dispatchError(err, "getPosts");
                }
            );
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    render: function() {
        var order = [];
        var posts;

        var last_viewed = Number.MAX_VALUE;

        if (ChannelStore.getCurrentMember() != null)
            last_viewed = ChannelStore.getCurrentMember().last_viewed_at;

        if (this.state.post_list != null) {
            posts = this.state.post_list.posts;
            order = this.state.post_list.order;
        }

        var rendered_last_viewed = false;

        var user_id = "";
        if (UserStore.getCurrentId()) {
            user_id = UserStore.getCurrentId();
        } else {
            return <div/>;
        }

        var channel = this.state.channel;

        var more_messages = <p className="beginning-messages-text">Beginning of Channel</p>;

        var userStyle = { color: UserStore.getCurrentUser().props.theme }

        if (channel != null) {
            if (order.length > 0 && order.length % Constants.POST_CHUNK_SIZE === 0) {
                more_messages = <a ref="loadmore" className="more-messages-text theme" href="#" onClick={this.getMorePosts}>Load more messages</a>;
            } else if (channel.type === 'D') {
                var teammate = utils.getDirectTeammate(channel.id)

                if (teammate) {
                    var teammate_name = teammate.nickname.length > 0 ? teammate.nickname : teammate.username;
                    more_messages = (
                        <div className="channel-intro">
                            <div className="post-profile-img__container channel-intro-img">
                                <img className="post-profile-img" src={"/api/v1/users/" + teammate.id + "/image?time=" + teammate.update_at} height="50" width="50" />
                            </div>
                            <div className="channel-intro-profile">
                                <strong><UserProfile userId={teammate.id} /></strong>
                            </div>
                            <p className="channel-intro-text">
                                {"This is the start of your private message history with " + teammate_name + "." }<br/>
                                {"Private messages and files shared here are not shown to people outside this area."}
                            </p>
                            <a className="intro-links" href="#" style={userStyle} data-toggle="modal" data-target="#edit_channel" data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}><i className="fa fa-pencil"></i>Set a description</a>
                        </div>
                    );
                } else {
                    more_messages = (
                        <div className="channel-intro">
                            <p className="channel-intro-text">{"This is the start of your private message history with this " + strings.Team + "mate. Private messages and files shared here are not shown to people outside this area."}</p>
                        </div>
                    );
                }
            } else if (channel.type === 'P' || channel.type === 'O') {
                var ui_name = channel.display_name
                var members = ChannelStore.getCurrentExtraInfo().members;
                var creator_name = "";

                for (var i = 0; i < members.length; i++) {
                    if (members[i].roles.indexOf('admin') > -1) {
                        creator_name = members[i].username;
                        break;
                    }
                }

                if (ChannelStore.isDefault(channel)) {
                    more_messages = (
                        <div className="channel-intro">
                            <h4 className="channel-intro__title">Beginning of {ui_name}</h4>
                            <p className="channel-intro__content">
                                Welcome to {ui_name}!
                                <br/><br/>
                                {"This is the first channel " + strings.Team + "mates see when they"}
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
                    more_messages = (
                        <div className="channel-intro">
                            <h4 className="channel-intro__title">Beginning of {ui_name}</h4>
                            <p className="channel-intro__content">
                                {"This is the start of " + ui_name + ", a channel for non-work-related conversations."}
                                <br/>
                            </p>
                            <a className="intro-links" href="#" style={userStyle} data-toggle="modal" data-target="#edit_channel" data-desc={channel.description} data-title={ui_name} data-channelid={channel.id}><i className="fa fa-pencil"></i>Set a description</a>
                        </div>
                    );
                } else {
                    var ui_type = channel.type === 'P' ? "private group" : "channel";
                    more_messages = (
                        <div className="channel-intro">
                            <h4 className="channel-intro__title">Beginning of {ui_name}</h4>
                            <p className="channel-intro__content">
                                { creator_name != "" ? "This is the start of the " + ui_name + " " + ui_type + ", created by " + creator_name + " on " + utils.displayDate(channel.create_at) + "."
                                : "This is the start of the " + ui_name + " " + ui_type + ", created on "+ utils.displayDate(channel.create_at) + "." }
                                { channel.type === 'P' ? " Only invited members can see this private group." : " Any member can join and read this channel." }
                                <br/>
                            </p>
                            <a className="intro-links" href="#" style={userStyle} data-toggle="modal" data-target="#edit_channel" data-desc={channel.description} data-title={channel.display_name} data-channelid={channel.id}><i className="fa fa-pencil"></i>Set a description</a>
                            <a className="intro-links" href="#" style={userStyle} data-toggle="modal" data-target="#channel_invite"><i className="fa fa-user-plus"></i>Invite others to this {ui_type}</a>
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
                var parentPost = post.parent_id ? posts[post.parent_id] : null;

                var sameUser = '';
                var sameRoot = false;
                var hideProfilePic = false;
                var prevPost = (i < order.length - 1) ? posts[order[i + 1]] : null;

                if (prevPost) {
                    sameUser = (prevPost.user_id === post.user_id) && (post.create_at - prevPost.create_at <= 1000*60*5) ? "same--user" : "";
                    sameRoot = utils.isComment(post) && (prevPost.id === post.root_id || prevPost.root_id === post.root_id);

                    // we only hide the profile pic if the previous post is not a comment, the current post is not a comment, and the previous post was made by the same user as the current post
                    hideProfilePic = (prevPost.user_id === post.user_id) && !utils.isComment(prevPost) && !utils.isComment(post);
                }

                // check if it's the last comment in a consecutive string of comments on the same post
                // it is the last comment if it is last post in the channel or the next post has a different root post
                var isLastComment = utils.isComment(post) && (i === 0 || posts[order[i-1]].root_id != post.root_id);

                var postCtl = (
                    <Post ref={post.id} sameUser={sameUser} sameRoot={sameRoot} post={post} parentPost={parentPost} key={post.id}
                        posts={posts} hideProfilePic={hideProfilePic} isLastComment={isLastComment}
                    />
                );

                currentPostDay = utils.getDateForUnixTicks(post.create_at);
                if (currentPostDay.toDateString() != previousPostDay.toDateString()) {
                    postCtls.push(
                        <div key={currentPostDay.toDateString()} className="date-separator">
                            <hr className="separator__hr" />
                            <div className="separator__text">{currentPostDay.toDateString()}</div>
                        </div>
                    );
                }

                if (post.create_at > last_viewed && !rendered_last_viewed) {
                    rendered_last_viewed = true;
                    postCtls.push(
                        <div key="unviewed" className="new-separator">
                            <hr id="new_message" className="separator__hr" />
                            <div className="separator__text">New Messages</div>
                        </div>
                    );
                }
                postCtls.push(postCtl);
                previousPostDay = currentPostDay;
            }
        } else {
            postCtls.push(<LoadingScreen position="absolute" />);
        }

        return (
            <div ref="postlist" className="post-list-holder-by-time">
                <div className="post-list__table">
                    <div className="post-list__content">
                        { more_messages }
                        { postCtls }
                    </div>
                </div>
            </div>
        );
    }
});
