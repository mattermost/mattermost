// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostStore from '../stores/post_store.jsx';
import UserStore from '../stores/user_store.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import * as Utils from '../utils/utils.jsx';
import SearchBox from './search_bar.jsx';
import CreateComment from './create_comment.jsx';
import RhsHeaderPost from './rhs_header_post.jsx';
import RootPost from './rhs_root_post.jsx';
import Comment from './rhs_comment.jsx';
import Constants from '../utils/constants.jsx';
import FileUploadOverlay from './file_upload_overlay.jsx';

export default class RhsThread extends React.Component {
    constructor(props) {
        super(props);

        this.onChange = this.onChange.bind(this);
        this.onChangeAll = this.onChangeAll.bind(this);
        this.forceUpdateInfo = this.forceUpdateInfo.bind(this);
        this.handleResize = this.handleResize.bind(this);

        const state = this.getStateFromStores();
        state.windowWidth = Utils.windowWidth();
        state.windowHeight = Utils.windowHeight();
        this.state = state;
    }
    getStateFromStores() {
        var postList = PostStore.getSelectedPost();
        if (!postList || postList.order.length < 1 || !postList.posts[postList.order[0]]) {
            return {postList: {}};
        }

        var channelId = postList.posts[postList.order[0]].channel_id;
        var pendingPostsList = PostStore.getPendingPosts(channelId);

        if (pendingPostsList) {
            for (var pid in pendingPostsList.posts) {
                if (pendingPostsList.posts.hasOwnProperty(pid)) {
                    postList.posts[pid] = pendingPostsList.posts[pid];
                }
            }
        }

        return {postList: postList};
    }
    componentDidMount() {
        PostStore.addSelectedPostChangeListener(this.onChange);
        PostStore.addChangeListener(this.onChangeAll);
        PreferenceStore.addChangeListener(this.forceUpdateInfo);
        this.resize();
        window.addEventListener('resize', this.handleResize);
    }
    componentDidUpdate() {
        if ($('.post-right__scroll')[0]) {
            $('.post-right__scroll').scrollTop($('.post-right__scroll')[0].scrollHeight);
        }
        this.resize();
    }
    componentWillUnmount() {
        PostStore.removeSelectedPostChangeListener(this.onChange);
        PostStore.removeChangeListener(this.onChangeAll);
        PreferenceStore.removeChangeListener(this.forceUpdateInfo);
        window.removeEventListener('resize', this.handleResize);
    }
    forceUpdateInfo() {
        if (this.state.postList) {
            for (var postId in this.state.postList.posts) {
                if (this.refs[postId]) {
                    this.refs[postId].forceUpdate();
                }
            }
        }
    }
    handleResize() {
        this.setState({
            windowWidth: Utils.windowWidth(),
            windowHeight: Utils.windowHeight()
        });
    }
    onChange() {
        var newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    onChangeAll() {
        // if something was changed in the channel like adding a
        // comment or post then lets refresh the sidebar list
        var currentSelected = PostStore.getSelectedPost();
        if (!currentSelected || currentSelected.order.length === 0 || !currentSelected.posts[currentSelected.order[0]]) {
            return;
        }

        var currentPosts = PostStore.getVisiblePosts(currentSelected.posts[currentSelected.order[0]].channel_id);

        if (!currentPosts || currentPosts.order.length === 0) {
            return;
        }

        if (currentPosts.posts[currentPosts.order[0]].channel_id === currentSelected.posts[currentSelected.order[0]].channel_id) {
            currentSelected.posts = {};
            for (var postId in currentPosts.posts) {
                if (currentPosts.posts.hasOwnProperty(postId)) {
                    currentSelected.posts[postId] = currentPosts.posts[postId];
                }
            }

            PostStore.storeSelectedPost(currentSelected);
        }

        var newState = this.getStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }
    resize() {
        $('.post-right__scroll').scrollTop(100000);
        if (this.state.windowWidth > 768) {
            $('.post-right__scroll').perfectScrollbar();
            $('.post-right__scroll').perfectScrollbar('update');
        }
    }
    render() {
        var postList = this.state.postList;

        if (postList == null || !postList.order) {
            return (
                <div></div>
            );
        }

        var selectedPost = postList.posts[postList.order[0]];
        var rootPost = null;

        if (selectedPost.root_id === '') {
            rootPost = selectedPost;
        } else {
            rootPost = postList.posts[selectedPost.root_id];
        }

        var postsArray = [];

        for (var postId in postList.posts) {
            if (postList.posts.hasOwnProperty(postId)) {
                var cpost = postList.posts[postId];
                if (cpost.root_id === rootPost.id) {
                    postsArray.push(cpost);
                }
            }
        }

        // sort failed posts to bottom, followed by pending, and then regular posts
        postsArray.sort(function postSort(a, b) {
            if ((a.state === Constants.POST_LOADING || a.state === Constants.POST_FAILED) && (b.state !== Constants.POST_LOADING && b.state !== Constants.POST_FAILED)) {
                return 1;
            }
            if ((a.state !== Constants.POST_LOADING && a.state !== Constants.POST_FAILED) && (b.state === Constants.POST_LOADING || b.state === Constants.POST_FAILED)) {
                return -1;
            }

            if (a.state === Constants.POST_LOADING && b.state === Constants.POST_FAILED) {
                return -1;
            }
            if (a.state === Constants.POST_FAILED && b.state === Constants.POST_LOADING) {
                return 1;
            }

            if (a.create_at < b.create_at) {
                return -1;
            }
            if (a.create_at > b.create_at) {
                return 1;
            }
            return 0;
        });

        var currentId = UserStore.getCurrentId();
        var searchForm;
        if (currentId != null) {
            searchForm = <SearchBox />;
        }

        return (
            <div className='post-right__container'>
                <FileUploadOverlay overlayType='right' />
                <div className='search-bar__container sidebar--right__search-header'>{searchForm}</div>
                <div className='sidebar-right__body'>
                    <RhsHeaderPost
                        fromSearch={this.props.fromSearch}
                        isMentionSearch={this.props.isMentionSearch}
                    />
                    <div className='post-right__scroll'>
                        <RootPost
                            ref={rootPost.id}
                            post={rootPost}
                            commentCount={postsArray.length}
                        />
                        <div className='post-right-comments-container'>
                        {postsArray.map(function mapPosts(comPost) {
                            return (
                                <Comment
                                    ref={comPost.id}
                                    key={comPost.id + 'commentKey'}
                                    post={comPost}
                                    selected={(comPost.id === selectedPost.id)}
                                />
                            );
                        })}
                        </div>
                        <div className='post-create__container'>
                            <CreateComment
                                channelId={rootPost.channel_id}
                                rootId={rootPost.id}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

RhsThread.defaultProps = {
    fromSearch: '',
    isMentionSearch: false
};

RhsThread.propTypes = {
    fromSearch: React.PropTypes.string,
    isMentionSearch: React.PropTypes.bool
};
