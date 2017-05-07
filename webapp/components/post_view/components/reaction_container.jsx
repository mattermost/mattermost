// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {addReaction, removeReaction} from 'actions/post_actions.jsx';
import * as UserActions from 'actions/user_actions.jsx';

import UserStore from 'stores/user_store.jsx';

import Reaction from './reaction.jsx';

export default class ReactionContainer extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        emojiName: React.PropTypes.string.isRequired,
        reactions: React.PropTypes.arrayOf(React.PropTypes.object),
        emojis: React.PropTypes.object.isRequired
    }

    constructor(props) {
        super(props);

        this.handleUsersChanged = this.handleUsersChanged.bind(this);

        this.getStateFromStore = this.getStateFromStore.bind(this);

        this.getProfilesForReactions = this.getProfilesForReactions.bind(this);
        this.getMissingProfiles = this.getMissingProfiles.bind(this);

        this.state = this.getStateFromStore(props);
    }

    componentDidMount() {
        UserStore.addChangeListener(this.handleUsersChanged);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.reactions !== this.props.reactions) {
            this.setState(this.getStateFromStore(nextProps));
        }
    }

    componentWillUnmount() {
        UserStore.removeChangeListener(this.handleUsersChanged);
    }

    handleUsersChanged() {
        this.setState(this.getStateFromStore());
    }

    getStateFromStore(props = this.props) {
        const profiles = this.getProfilesForReactions(props.reactions);
        const otherUsers = props.reactions.length - profiles.length;

        return {
            profiles,
            otherUsers,
            currentUserId: UserStore.getCurrentId()
        };
    }

    getProfilesForReactions(reactions) {
        return reactions.map((reaction) => {
            return UserStore.getProfile(reaction.user_id);
        }).filter((profile) => Boolean(profile));
    }

    getMissingProfiles() {
        const ids = this.props.reactions.map((reaction) => reaction.user_id);

        UserActions.getMissingProfiles(ids);
    }

    render() {
        return (
            <Reaction
                {...this.props}
                {...this.state}
                actions={{
                    addReaction,
                    getMissingProfiles: this.getMissingProfiles,
                    removeReaction
                }}
            />
        );
    }
}
