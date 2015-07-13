// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PostStore = require('../stores/post_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var UserProfile = require( './user_profile.jsx' );
var UserStore = require('../stores/user_store.jsx');
var AppDispatcher = require('../dispatcher/app_dispatcher.jsx');
var utils = require('../utils/utils.jsx');
var SearchBox =require('./search_bar.jsx');
var CreateComment = require( './create_comment.jsx' );
var Constants = require('../utils/constants.jsx');
var ViewImageModal = require('./view_image.jsx');
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
        var back = this.props.fromSearch ? <a href="#" onClick={this.handleBack} style={{color:"black"}}>{"< "}</a> : "";

        return (
            <div className="sidebar--right__header">
                <span className="sidebar--right__title">{back}Message Details</span>
                <button type="button" className="sidebar--right__close" aria-label="Close" onClick={this.handleClose}></button>
            </div>
        );
    }
});

RootPost = React.createClass({
    handleImageClick: function(e) {
        this.setState({startImgId: parseInt($(e.target.parentNode).attr('data-img-id'))});
    },
    getInitialState: function() {
        return { startImgId: 0 };
    },
    render: function() {

        var postImageModalId = "rhs_view_image_modal_" + this.props.post.id;
        var message = utils.textToJsx(this.props.post.message);
        var filenames = this.props.post.filenames;
        var isOwner = UserStore.getCurrentId() == this.props.post.user_id;
        var timestamp = UserStore.getProfile(this.props.post.user_id).update_at;

        var type = "Post";
        if (this.props.post.root_id.length > 0) {
            type = "Comment";
        }

        var currentUserCss = "";
        if (UserStore.getCurrentId() === this.props.post.user_id) {
            currentUserCss = "current--user";
        }

        if (filenames) {
            var postFiles = [];
            var images = [];
            var re1 = new RegExp(' ', 'g');
            var re2 = new RegExp('\\(', 'g');
            var re3 = new RegExp('\\)', 'g');
            for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
                var fileSplit = filenames[i].split('.');
                if (fileSplit.length < 2) continue;

                var ext = fileSplit[fileSplit.length-1];
                fileSplit.splice(fileSplit.length-1,1);
                var filePath = fileSplit.join('.');
                var filename = filePath.split('/')[filePath.split('/').length-1];

                var ftype = utils.getFileType(ext);

                if (ftype === "image") {
                    var url = filePath.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');
                    postFiles.push(
                        <div className="post-image__column" key={filePath}>
                            <a href="#" onClick={this.handleImageClick} data-img-id={images.length.toString()} data-toggle="modal" data-target={"#" + postImageModalId }><div ref={filePath} className="post__image" style={{backgroundImage: 'url(' + url + '_thumb.jpg)'}}></div></a>
                        </div>
                    );
                    images.push(filenames[i]);
                } else {
                    postFiles.push(
                        <div className="post-image__column custom-file" key={filePath}>
                            <a href={filePath+"."+ext} download={filename+"."+ext}>
                                <div className={"file-icon "+utils.getIconClassName(ftype)}/>
                            </a>
                        </div>
                    );
                }
            }
        }

        return (
            <div className={"post post--root " + currentUserCss}>
                <div className="post-profile-img__container">
                    <img className="post-profile-img" src={"/api/v1/users/" + this.props.post.user_id + "/image?time=" + timestamp} height="36" width="36" />
                </div>
                <div className="post__content">
                    <ul className="post-header">
                        <li className="post-header-col"><strong><UserProfile userId={this.props.post.user_id} /></strong></li>
                        <li className="post-header-col"><time className="post-right-root-time">{ utils.displayDate(this.props.post.create_at)+' '+utils.displayTime(this.props.post.create_at)  }</time></li>
                        <li className="post-header-col post-header__reply">
                            <div className="dropdown">
                            { isOwner ?
                                <div>
                                <a href="#" className="dropdown-toggle theme" type="button" data-toggle="dropdown" aria-expanded="false">
                                    [...]
                                </a>
                                <ul className="dropdown-menu" role="menu">
                                    <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#edit_post" data-title={type} data-message={this.props.post.message} data-postid={this.props.post.id} data-channelid={this.props.post.channel_id}>Edit</a></li>
                                    <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#delete_post" data-title={type} data-postid={this.props.post.id} data-channelid={this.props.post.channel_id} data-comments={this.props.commentCount}>Delete</a></li>
                                </ul>
                                </div>
                            : "" }
                            </div>
                        </li>
                    </ul>
                    <div className="post-body">
                        <p>{message}</p>
                        { filenames.length > 0 ?
                            <div className="post-image__columns">
                                { postFiles }
                            </div>
                        : "" }
                        { images.length > 0 ?
                            <ViewImageModal
                            channelId={this.props.post.channel_id}
                            userId={this.props.post.user_id}
                            modalId={postImageModalId}
                            startId={this.state.startImgId}
                            imgCount={this.props.post.img_count}
                            filenames={images} />
                        : "" }
                    </div>
                </div>
                <hr />
            </div>
        );
    }
});

CommentPost = React.createClass({
    handleImageClick: function(e) {
        this.setState({startImgId: parseInt($(e.target.parentNode).attr('data-img-id'))});
    },
    getInitialState: function() {
        return { startImgId: 0 };
    },
    render: function() {

        var commentClass = "post";

        var currentUserCss = "";
        if (UserStore.getCurrentId() === this.props.post.user_id) {
            currentUserCss = "current--user";
        }

        var postImageModalId = "rhs_comment_view_image_modal_" + this.props.post.id;
        var filenames = this.props.post.filenames;
        var isOwner = UserStore.getCurrentId() == this.props.post.user_id;

        var type = "Post"
        if (this.props.post.root_id.length > 0) {
            type = "Comment"
        }

        if (filenames) {
            var postFiles = [];
            var images = [];
            var re1 = new RegExp(' ', 'g');
            var re2 = new RegExp('\\(', 'g');
            var re3 = new RegExp('\\)', 'g');
            for (var i = 0; i < filenames.length && i < Constants.MAX_DISPLAY_FILES; i++) {
                var fileSplit = filenames[i].split('.');
                if (fileSplit.length < 2) continue;

                var ext = fileSplit[fileSplit.length-1];
                fileSplit.splice(fileSplit.length-1,1)
                var filePath = fileSplit.join('.');
                var filename = filePath.split('/')[filePath.split('/').length-1];

                var type = utils.getFileType(ext);

                if (type === "image") {
                    var url = filePath.replace(re1, '%20').replace(re2, '%28').replace(re3, '%29');
                    postFiles.push(
                        <div className="post-image__column" key={filename}>
                            <a href="#" onClick={this.handleImageClick} data-img-id={images.length.toString()} data-toggle="modal" data-target={"#" + postImageModalId }><div ref={filename} className="post__image" style={{backgroundImage: 'url(' + url + '_thumb.jpg)'}}></div></a>
                        </div>
                    );
                    images.push(filenames[i]);
                } else {
                    postFiles.push(
                        <div className="post-image__column custom-file" key={filename}>
                            <a href={filePath+"."+ext} download={filename+"."+ext}>
                                <div className={"file-icon "+utils.getIconClassName(type)}/>
                            </a>
                        </div>
                    );
                }
            }
        }

        var message = utils.textToJsx(this.props.post.message);
        var timestamp = UserStore.getCurrentUser().update_at;

        return (
            <div className={commentClass + " " + currentUserCss}>
                <div className="post-profile-img__container">
                    <img className="post-profile-img" src={"/api/v1/users/" + this.props.post.user_id + "/image?time=" + timestamp} height="36" width="36" />
                </div>
                <div className="post__content">
                    <ul className="post-header">
                        <li className="post-header-col"><strong><UserProfile userId={this.props.post.user_id} /></strong></li>
                        <li className="post-header-col"><time className="post-right-comment-time">{ utils.displayDateTime(this.props.post.create_at) }</time></li>
                        <li className="post-header-col post-header__reply">
                        { isOwner ?
                        <div className="dropdown" onClick={function(e){$('.post-list-holder-by-time').scrollTop($(".post-list-holder-by-time").scrollTop() + 50);}}>
                            <a href="#" className="dropdown-toggle theme" type="button" data-toggle="dropdown" aria-expanded="false">
                                [...]
                            </a>
                            <ul className="dropdown-menu" role="menu">
                                <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#edit_post" data-title={type} data-message={this.props.post.message} data-postid={this.props.post.id} data-channelid={this.props.post.channel_id}>Edit</a></li>
                                <li role="presentation"><a href="#" role="menuitem" data-toggle="modal" data-target="#delete_post" data-title={type} data-postid={this.props.post.id} data-channelid={this.props.post.channel_id} data-comments={0}>Delete</a></li>
                            </ul>
                        </div>
                        : "" }
                        </li>
                    </ul>
                    <div className="post-body">
                        <p>{message}</p>
                        { filenames.length > 0 ?
                            <div className="post-image__columns">
                                { postFiles }
                            </div>
                        : "" }
                        { images.length > 0 ?
                            <ViewImageModal
                            channelId={this.props.post.channel_id}
                            userId={this.props.post.user_id}
                            modalId={postImageModalId}
                            startId={this.state.startImgId}
                            imgCount={this.props.post.img_count}
                            filenames={images} />
                        : "" }
                    </div>
                </div>
            </div>
        );
    }
});

function getStateFromStores() {
  return { post_list: PostStore.getSelectedPost() };
}

module.exports = React.createClass({
    wasForced: false,
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
<<<<<<< HEAD
        if(this.wasForced){
            this.wasForced = false
        } else {
            this.resize();
=======
        if(!this.wasForced){
            this.resize();
            wasForced = false
>>>>>>> Added timestamp updates to right side and cleaned code
        }
    },
    componentWillUnmount: function() {
        PostStore.removeSelectedPostChangeListener(this._onChange);
        PostStore.removeChangeListener(this._onChangeAll);
<<<<<<< HEAD
        UserStore.removeStatusesChangeListener(this._onTimeChange);
=======
        UserStore.removeStatusesChangeListener(this._onTimeChange)
>>>>>>> Added timestamp updates to right side and cleaned code
    },
    _onChange: function() {

        // Restricts the special case of holding your place during a refresh
        // to only when it's updating the timestamp
        this.wasForced = false;

        if (this.isMounted()) {
            var newState = getStateFromStores();
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    _onChangeAll: function() {

        // Restricts the special case of holding your place during a refresh
        // to only when it's updating the timestamp
        this.wasForced = false;

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
        this.wasForced = true;
        for (var key in this.refs) {
            if(this.refs[key].forceUpdate != undefined) {
                this.refs[key].forceUpdate();
            }
        }
    },
    getInitialState: function() {
        return getStateFromStores();
    },
    resize: function() {
        var height = $(window).height() - $('#error_bar').outerHeight() - 100;
        $(".post-right__scroll").css("height", height + "px");
        $(".post-right__scroll").scrollTop(100000);
        $(".post-right__scroll").perfectScrollbar();
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

        if (selected_post.root_id == "") {
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
            <div className="post-right__container">
                <div className="search-bar__container sidebar--right__search-header">{searchForm}</div>
                <div className="sidebar-right__body">
                    <RhsHeaderPost fromSearch={this.props.fromSearch} isMentionSearch={this.props.isMentionSearch} />
                    <div className="post-right__scroll">
                        <RootPost post={root_post} commentCount={posts_array.length}/>
                        <div className="post-right-comments-container">
                        { posts_array.map(function(cpost) {
                                return <CommentPost ref={cpost.id} key={cpost.id} post={cpost} selected={ (cpost.id == selected_post.id) } />
                        })}
                        </div>
                        <div className="post-create__container">
                            <CreateComment channelId={root_post.channel_id} rootId={root_post.id} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
