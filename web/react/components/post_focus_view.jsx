// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostsView from './posts_view.jsx';

import PostStore from '../stores/post_store.jsx';
import ChannelStore from '../stores/channel_store.jsx';
import * as EventHelpers from '../dispatcher/event_helpers.jsx';

export default class PostFocusView extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelChange = this.onChannelChange.bind(this);
        this.onPostsChange = this.onPostsChange.bind(this);
        this.handlePostsViewScroll = this.handlePostsViewScroll.bind(this);
        this.loadMorePostsTop = this.loadMorePostsTop.bind(this);
        this.loadMorePostsBottom = this.loadMorePostsBottom.bind(this);

        const focusedPostId = PostStore.getFocusedPostId();

        this.state = {
            scrollType: PostsView.SCROLL_TYPE_POST,
            scrollPostId: focusedPostId,
            postList: PostStore.getVisiblePosts(focusedPostId),
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId)
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
        PostStore.addChangeListener(this.onPostsChange);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
        PostStore.removeChangeListener(this.onPostsChange);
    }

    onChannelChange() {
        this.setState({
            scrollType: PostsView.SCROLL_TYPE_POST
        });
    }

    onPostsChange() {
        const focusedPostId = PostStore.getFocusedPostId();
        if (focusedPostId == null) {
            return;
        }

        this.setState({
            scrollPostId: focusedPostId,
            postList: PostStore.getVisiblePosts(focusedPostId),
            atTop: PostStore.getVisibilityAtTop(focusedPostId),
            atBottom: PostStore.getVisibilityAtBottom(focusedPostId)
        });
    }

    handlePostsViewScroll() {
        this.setState({scrollType: PostsView.SCROLL_TYPE_FREE});
    }

    loadMorePostsTop() {
        EventHelpers.emitLoadMorePostsFocusedTopEvent();
    }

    loadMorePostsBottom() {
        EventHelpers.emitLoadMorePostsFocusedBottomEvent();
    }

    getIntroMessage() {
        return (
            <div className='channel-intro'>
                <h4 className='channel-intro__title'>{'Beginning of Channel'}</h4>
            </div>
        );
    }

    render() {
        const postsToHighlight = {};
        postsToHighlight[this.state.scrollPostId] = true;

        return (
            <div id='post-list'>
                <PostsView
                    key={'postfocusview'}
                    isActive={true}
                    postList={this.state.postList}
                    scrollType={this.state.scrollType}
                    scrollPostId={this.state.scrollPostId}
                    postViewScrolled={this.handlePostsViewScroll}
                    loadMorePostsTopClicked={this.loadMorePostsTop}
                    loadMorePostsBottomClicked={this.loadMorePostsBottom}
                    showMoreMessagesTop={!this.state.atTop}
                    showMoreMessagesBottom={!this.state.atBottom}
                    introText={this.getIntroMessage()}
                    messageSeparatorTime={0}
                    postsToHighlight={postsToHighlight}
                />
            </div>
        );
    }
}
PostFocusView.defaultProps = {
};

PostFocusView.propTypes = {
};
