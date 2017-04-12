// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from '../dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';
import EventEmitter from 'events';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'changed';

class ReactionStore extends EventEmitter {
    constructor() {
        super();

        this.dispatchToken = AppDispatcher.register(this.handleEventPayload.bind(this));

        this.reactions = new Map();

        this.setMaxListeners(600);
    }

    addChangeListener(postId, callback) {
        this.on(CHANGE_EVENT + postId, callback);
    }

    removeChangeListener(postId, callback) {
        this.removeListener(CHANGE_EVENT + postId, callback);
    }

    emitChange(postId) {
        this.emit(CHANGE_EVENT + postId, postId);
    }

    setReactions(postId, reactions) {
        this.reactions.set(postId, reactions);
    }

    addReaction(postId, reaction) {
        let reactions = this.getReactions(postId) || [];

        // Make sure not to add duplicates
        const existingIndex = reactions.findIndex((existing) => {
            return existing.user_id === reaction.user_id && existing.post_id === reaction.post_id && existing.emoji_name === reaction.emoji_name;
        });

        if (existingIndex === -1) {
            reactions = [...reactions, reaction];
        }

        this.setReactions(postId, reactions);
    }

    removeReaction(postId, reaction) {
        let reactions = this.getReactions(postId) || [];

        const existingIndex = reactions.findIndex((existing) => {
            return existing.user_id === reaction.user_id && existing.post_id === reaction.post_id && existing.emoji_name === reaction.emoji_name;
        });

        if (existingIndex !== -1) {
            reactions = reactions.slice(0, existingIndex).concat(reactions.slice(existingIndex + 1));
        }

        this.setReactions(postId, reactions);
    }

    getReactions(postId) {
        return this.reactions.get(postId);
    }

    handleEventPayload(payload) {
        const action = payload.action;

        switch (action.type) {
        case ActionTypes.RECEIVED_REACTIONS:
            this.setReactions(action.postId, action.reactions);
            this.emitChange(action.postId);
            break;
        case ActionTypes.ADDED_REACTION:
            this.addReaction(action.postId, action.reaction);
            this.emitChange(action.postId);
            break;
        case ActionTypes.REMOVED_REACTION:
            this.removeReaction(action.postId, action.reaction);
            this.emitChange(action.postId);
            break;
        }
    }
}

export default new ReactionStore();
