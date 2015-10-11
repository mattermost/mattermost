// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const PostList = require('./post_list.jsx');
const ChannelStore = require('../stores/channel_store.jsx');

export default class PostListContainer extends React.Component {
    constructor() {
        super();

        this.onChange = this.onChange.bind(this);
        this.onLeave = this.onLeave.bind(this);

        let currentChannelId = ChannelStore.getCurrentId();
        if (currentChannelId) {
            this.state = {currentChannelId: currentChannelId, postLists: [currentChannelId]};
        } else {
            this.state = {currentChannelId: null, postLists: []};
        }
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.onChange);
        ChannelStore.addLeaveListener(this.onLeave);
    }
    onChange() {
        let channelId = ChannelStore.getCurrentId();
        if (channelId === this.state.currentChannelId) {
            return;
        }

        let postLists = this.state.postLists;
        if (postLists.indexOf(channelId) === -1) {
            postLists.push(channelId);
        }
        this.setState({currentChannelId: channelId, postLists: postLists});
    }
    onLeave(id) {
        let postLists = this.state.postLists;
        var index = postLists.indexOf(id);
        if (index !== -1) {
            postLists.splice(index, 1);
        }
    }
    render() {
        let postLists = this.state.postLists;
        let channelId = this.state.currentChannelId;

        let postListCtls = [];
        for (let i = 0; i <= this.state.postLists.length - 1; i++) {
            postListCtls.push(
                <PostList
                    key={'postlistkey' + i}
                    channelId={postLists[i]}
                    isActive={postLists[i] === channelId}
                />
            );
        }

        return (
            <div>{postListCtls}</div>
        );
    }
}
