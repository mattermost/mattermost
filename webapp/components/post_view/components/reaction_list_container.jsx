// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import EmojiStore from 'stores/emoji_store.jsx';
import ReactionStore from 'stores/reaction_store.jsx';

import ReactionListView from './reaction_list_view.jsx';

export default class ReactionListContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired
    }

    constructor(props) {
        super(props);

        this.handleReactionsChanged = this.handleReactionsChanged.bind(this);
        this.handleEmojisChanged = this.handleEmojisChanged.bind(this);

        this.state = {
            reactions: ReactionStore.getReactions(this.props.post.id),
            emojis: EmojiStore.getEmojis()
        };
    }

    componentDidMount() {
        ReactionStore.addChangeListener(this.props.post.id, this.handleReactionsChanged);
        EmojiStore.addChangeListener(this.handleEmojisChanged);

        if (this.props.post.has_reactions) {
            AsyncClient.listReactions(this.props.post.channel_id, this.props.post.id);
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.post.id !== this.props.post.id) {
            ReactionStore.removeChangeListener(this.props.post.id, this.handleReactionsChanged);
            ReactionStore.addChangeListener(nextProps.post.id, this.handleReactionsChanged);

            this.setState({
                reactions: ReactionStore.getReactions(nextProps.post.id)
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps.post.has_reactions !== this.props.post.has_reactions) {
            return true;
        }

        if (nextState.reactions !== this.state.reactions) {
            // this will only work so long as the entries in the ReactionStore are never mutated
            return true;
        }

        if (nextState.emojis !== this.state.emojis) {
            return true;
        }

        return false;
    }

    componentWillUnmount() {
        ReactionStore.removeChangeListener(this.props.post.id, this.handleReactionsChanged);
        EmojiStore.removeChangeListener(this.handleEmojisChanged);
    }

    handleReactionsChanged() {
        this.setState({
            reactions: ReactionStore.getReactions(this.props.post.id)
        });
    }

    handleEmojisChanged() {
        this.setState({
            emojis: EmojiStore.getEmojis()
        });
    }

    render() {
        return (
            <ReactionListView
                post={this.props.post}
                reactions={this.state.reactions}
                emojis={this.state.emojis}
            />
        );
    }
}
