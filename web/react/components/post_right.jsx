// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserProfile = require('./user_profile.jsx');
var UserStore = require('../stores/user_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var SearchBox = require('./search_bar.jsx');
var CreateComment = require('./create_comment.jsx');
var Constants = require('../utils/constants.jsx');
var FileAttachmentList = require('./file_attachment_list.jsx');
var client = require('../utils/client.jsx');
var AsyncClient = require('../utils/async_client.jsx');
var ActionTypes = Constants.ActionTypes;

RhsHeaderPost = React.createClass({
    handleClose: function(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH,
            results: null
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    },
    handleBack: function(e) {
        e.preventDefault();

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_SEARCH_TERM,
            term: this.props.fromSearch,
            do_search: true,
            is_mention_search: this.props.isMentionSearch
        });

        AppDispatcher.handleServerAction({
            type: ActionTypes.RECIEVED_POST_SELECTED,
            results: null
        });
    },
    render: function() {
        var back;
        if (this.props.fromSearch) {
            back = <a href='#' onClick={this.handleBack} className='sidebar--right__back'><i className='fa fa-chevron-left'></i></a>;
        }

        return (
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>{back}Message Details</span>
                <button type='button' className='sidebar--right__close' aria-label='Close' onClick={this.handleClose}></button>
            </div>
        );
    }
});

RootPost = React.createClass({
    render: function() {
        var post = this.props.post;
        var message = utils.textToJsx(post.message);
        var isOwner = UserStore.getCurrentId() === post.user_id;
        var timestamp = UserStore.getProfile(post.user_id).update_at;
        var channel = ChannelStore.get(post.channel_id);

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var channelName;
        if (channel) {
            if (channel.type === 'D') {
                channelName = 'Private Message';
            } else {
                channelName = channel.display_name;
            }
        }

        var ownerOptions;
        if (isOwner) {
            ownerOptions = (
                <div>
                    <a href='#' className='dropdown-toggle theme' type='button' data-toggle='dropdown' aria-expanded='false' />
                    <ul className='dropdown-menu' role='menu'>
                        <li role='presentation'><a href='#' role='menuitem' data-toggle='modal' data-target='#edit_post' data-title={type} data-message={post.message} data-postid={post.id} data-channelid={post.channel_id}>Edit</a></li>
                        <li role='presentation'><a href='#' role='menuitem' data-toggle='modal' data-target='#delete_post' data-title={type} data-postid={post.id} data-channelid={post.channel_id} data-comments={this.props.commentCount}>Delete</a></li>
                    </ul>
                </div>
            );
        }

        var fileAttachment;
        if (post.filenames && post.filenames.length > 0) {
            fileAttachment = (
                <FileAttachmentList
                    filenames={post.filenames}
                    modalId={'rhs_view_image_modal_' + post.id}
                    channelId={post.channel_id}
                    userId={post.user_id} />
            );
        }

        return (
            <div className={'post post--root ' + currentUserCss}>
                <div className='post-right-channel__name'>{ channelName }</div>
                <div className='post-profile-img__container'>
                    <img className='post-profile-img' src={'/api/v1/users/' + post.user_id + '/image?time=' + timestamp} height='36' width='36' />
                </div>
                <div className='post__content'>
                    <ul className='post-header'>
                        <li className='post-header-col'><strong><UserProfile userId={post.user_id} /></strong></li>
                        <li className='post-header-col'><time className='post-right-root-time'>{utils.displayDate(post.create_at) + ' ' + utils.displayTime(post.create_at)}</time></li>
                        <li className='post-header-col post-header__reply'>
                            <div className='dropdown'>
                                {ownerOptions}
                            </div>
                        </li>
                    </ul>
                    <div className='post-body'>
                        <p>{message}</p>
                        {fileAttachment}
                    </div>
                </div>
                <hr />
            </div>
        );
    }
});

CommentPost = React.createClass({
    retryComment: function(e) {
        e.preventDefault();

        var post = this.props.post;
        client.createPost(post, post.channel_id,
            function(data) {
                AsyncClient.getPosts(true);

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date).getTime();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECIEVED_POST,
                    post: data
                });
            }.bind(this),
            function(err) {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }.bind(this)
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    },
    render: function() {
        var commentClass = 'post';
        var post = this.props.post;

        var currentUserCss = '';
        if (UserStore.getCurrentId() === post.user_id) {
            currentUserCss = 'current--user';
        }

        var isOwner = UserStore.getCurrentId() === post.user_id;

        var type = 'Post';
        if (post.root_id.length > 0) {
            type = 'Comment';
        }

        var message = utils.textToJsx(post.message);
        var timestamp = UserStore.getCurrentUser().update_at;

        var loading;
        var postClass = '';
        if (post.state === Constants.POST_FAILED) {
            postClass += ' post-fail';
            loading = <a className='theme post-retry pull-right' href='#' onClick={this.retryComment}>Retry</a>;
        } else if (post.state === Constants.POST_LOADING) {
            postClass += ' post-waiting';
            loading = <img className='post-loading-gif pull-right' src='/static/images/load.gif'/>;
        }

        var ownerOptions;
        if (isOwner && post.state !== Constants.POST_FAILED && post.state !== Constants.POST_LOADING) {
            ownerOptions = (
                <div className='dropdown' onClick={function(e){$('.post-list-holder-by-time').scrollTop($('.post-list-holder-by-time').scrollTop() + 50);}}>
                    <a href='#' className='dropdown-toggle theme' type='button' data-toggle='dropdown' aria-expanded='false' />
                    <ul className='dropdown-menu' role='menu'>
                        <li role='presentation'><a href='#' role='menuitem' data-toggle='modal' data-target='#edit_post' data-title={type} data-message={post.message} data-postid={post.id} data-channelid={post.channel_id}>Edit</a></li>
                        <li role='presentation'><a href='#' role='menuitem' data-toggle='modal' data-target='#delete_post' data-title={type} data-postid={post.id} data-channelid={post.channel_id} data-comments={0}>Delete</a></li>
                    </ul>
                </div>
            );
        }

        var fileAttachment;
        if (post.filenames && post.filenames.length > 0) {
            fileAttachment = (
                <FileAttachmentList
                    filenames={post.filenames}
                    modalId={'rhs_comment_view_image_modal_' + post.id}
                    channelId={post.channel_id}
                    userId={post.user_id} />
            );
        }

        return (
            <div className={commentClass + ' ' + currentUserCss}>
                <div className='post-profile-img__container'>
                    <img className='post-profile-img' src={'/api/v1/users/' + post.user_id + '/image?time=' + timestamp} height='36' width='36' />
                </div>
                <div className='post__content'>
                    <ul className='post-header'>
                        <li className='post-header-col'><strong><UserProfile userId={post.user_id} /></strong></li>
                        <li className='post-header-col'><time className='post-right-comment-time'>{utils.displayDateTime(post.create_at)}</time></li>
                        <li className='post-header-col post-header__reply'>
                            {ownerOptions}
                        </li>
                    </ul>
                    <div className='post-body'>
                        <p className={postClass}>{loading}{message}</p>
                        {fileAttachment}
                    </div>
                </div>
            </div>
        );
    }
});

function getStateFromStores() {
    var post_list = PostStore.getSelectedPost();
    if (!post_list || post_list.order.length < 1) return { post_list: {} };

    var channel_id = post_list.posts[post_list.order[0]].channel_id;
    var pending_post_list = PostStore.getPendingPosts(channel_id);

    if (pending_post_list) {
        for (var pid in pending_post_list.posts) { post_list.posts[pid] = pending_post_list.posts[pid] };
    }

    return { post_list: post_list };
}

module.exports = React.createClass({
    componentDidMount: function() {
        PostStore.addSelectedPostChangeListener(this._onChange);
        PostStore.addChangeListener(this._onChangeAll);
        UserStore.addStatusesChangeListener(this._onTimeChange);
        this.resize();
        var self = this;
        $(window).resize(function(){
            self.resize();
        });
    },
    componentDidUpdate: function() {
        $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        $('.post-right__scroll').perfectScrollbar('update');
        this.resize();
    },
    componentWillUnmount: function() {
        PostStore.removeSelectedPostChangeListener(this._onChange);
        PostStore.removeChangeListener(this._onChangeAll);
        UserStore.removeStatusesChangeListener(this._onTimeChange);
    },
    _onChange: function() {
        if (this.isMounted()) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    _onChangeAll: function() {
        if (this.isMounted()) {

            // if something was changed in the channel like adding a
            // comment or post then lets refresh the sidebar list
            var currentSelected = PostStore.getSelectedPost();
            if (!currentSelected || currentSelected.order.length == 0) {
                return;
            }

            var currentPosts = PostStore.getPosts(currentSelected.posts[currentSelected.order[0]].channel_id);

            if (!currentPosts || currentPosts.order.length == 0) {
                return;
            }


            if (currentPosts.posts[currentPosts.order[0]].channel_id == currentSelected.posts[currentSelected.order[0]].channel_id) {
                currentSelected.posts = {};
                for (var postId in currentPosts.posts) {
                    currentSelected.posts[postId] = currentPosts.posts[postId];
                }

                PostStore.storeSelectedPost(currentSelected);
            }

            this.setState(getStateFromStores());
        }
    },
    _onTimeChange: function() {
        for (var id in this.state.post_list.posts) {
            if (!this.refs[id]) continue;
            this.refs[id].forceUpdate();
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    resize: function() {
        var height = $(window).height() - $('#error_bar').outerHeight() - 100;
        $('.post-right__scroll').css('height', height + 'px');
        $('.post-right__scroll').scrollTop(100000);
        $('.post-right__scroll').perfectScrollbar();
        $('.post-right__scroll').perfectScrollbar('update');
    },
    render: function() {

        var post_list = this.state.post_list;

        if (post_list == null) {
            return (
                <div></div>
            );
        }

        var selected_post = post_list.posts[post_list.order[0]];
        var root_post = null;

        if (selected_post.root_id == '') {
            root_post = selected_post;
        }
        else {
            root_post = post_list.posts[selected_post.root_id];
        }

        var posts_array = [];

        for (var postId in post_list.posts) {
            var cpost = post_list.posts[postId];
            if (cpost.root_id == root_post.id) {
                posts_array.push(cpost);
            }
        }

        posts_array.sort(function(a,b) {
            if (a.create_at < b.create_at)
                return -1;
            if (a.create_at > b.create_at)
                return 1;
            return 0;
        });

        var results = this.state.results;
        var currentId = UserStore.getCurrentId();
        var searchForm = currentId == null ? null : <SearchBox />;

        return (
            <div className='post-right__container'>
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <RhsHeaderPost fromSearch={this.props.fromSearch} isMentionSearch={this.props.isMentionSearch} />
                    <div className='post-right__scroll'>
                        <RootPost post={root_post} commentCount={posts_array.length}/>
                        <div className='post-right-comments-container'>
                        { posts_array.map(function(cpost) {
                                return <CommentPost ref={cpost.id} key={cpost.id} post={cpost} selected={ (cpost.id == selected_post.id) } />
                        })}
                        </div>
                        <div className='post-create__container'>
                            <CreateComment channelId={root_post.channel_id} rootId={root_post.id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
