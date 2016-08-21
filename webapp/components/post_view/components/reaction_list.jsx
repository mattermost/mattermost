// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Reaction from './reaction.jsx';

export default class ReactionList extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        currentUserId: React.PropTypes.string.isRequired,
        reactions: React.PropTypes.arrayOf(React.PropTypes.object)
    }

    render() {
        const reactionsByName = new Map();
        const emojiNames = [];

        for (const reaction of this.props.reactions) {
            const emojiName = reaction.emoji_name;

            if (reactionsByName.has(emojiName)) {
                reactionsByName.get(emojiName).push(reaction);
            } else {
                emojiNames.push(emojiName);
                reactionsByName.set(emojiName, [reaction]);
            }
        }

        const children = emojiNames.sort().map((emojiName) => {
            return (
                <Reaction
                    key={emojiName}
                    post={this.props.post}
                    currentUserId={this.props.currentUserId}
                    emojiName={emojiName}
                    reactions={reactionsByName.get(emojiName)}
                />
            );
        });

        return (
            <div className='post-reaction-list'>
                {children}
            </div>
        );
    }
}