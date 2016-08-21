// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import ReactionStore from 'stores/reaction_store.jsx';

import ReactionList from './reaction_list.jsx';

export default class ReactionListContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        currentUserId: React.PropTypes.string.isRequired
    }

    constructor(props) {
        super(props);

        this.handleReactionsChanged = this.handleReactionsChanged.bind(this);

        this.state = {
            reactions: ReactionStore.getReactions(this.props.post.id)
        };
    }

    componentDidMount() {
        ReactionStore.addChangeListener(this.props.post.id, this.handleReactionsChanged);

        if (this.props.post.has_reactions) {
            AsyncClient.listReactions(this.props.post.channel_id, this.props.post.id);
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

        return false;
    }

    componentWillUnmount() {
        ReactionStore.removeChangeListener(this.props.post.id, this.handleReactionsChanged);
    }

    handleReactionsChanged() {
        this.setState({
            reactions: ReactionStore.getReactions(this.props.post.id)
        });
    }

    render() {
        if (!this.props.post.has_reactions) {
            return null;
        }

        return (
            <ReactionList
                post={this.props.post}
                currentUserId={this.props.currentUserId}
                reactions={this.state.reactions}
            />
        );
    }
}