// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import Reaction from './reaction_container.jsx';

export default class ReactionListView extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        reactions: React.PropTypes.arrayOf(React.PropTypes.object),
        emojis: React.PropTypes.object.isRequired
    }

    render() {
        if (!this.props.post.has_reactions || (this.props.reactions && this.props.reactions.length === 0)) {
            return null;
        }

        const reactionsByName = new Map();
        const emojiNames = [];

        if (this.props.reactions) {
            for (const reaction of this.props.reactions) {
                const emojiName = reaction.emoji_name;

                if (reactionsByName.has(emojiName)) {
                    reactionsByName.get(emojiName).push(reaction);
                } else {
                    emojiNames.push(emojiName);
                    reactionsByName.set(emojiName, [reaction]);
                }
            }
        }

        const children = emojiNames.map((emojiName) => {
            return (
                <Reaction
                    key={emojiName}
                    post={this.props.post}
                    emojiName={emojiName}
                    reactions={reactionsByName.get(emojiName)}
                    emojis={this.props.emojis}
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
