// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedHTMLMessage, FormattedMessage} from 'react-intl';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

export default class Reaction extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        currentUserId: React.PropTypes.string.isRequired,
        emojiName: React.PropTypes.string.isRequired,
        reactions: React.PropTypes.arrayOf(React.PropTypes.object)
    }

    constructor(props) {
        super(props);

        this.addReaction = this.addReaction.bind(this);
        this.removeReaction = this.removeReaction.bind(this);
    }

    addReaction(e) {
        e.preventDefault();
        PostActions.addReaction(this.props.post.channel_id, this.props.post.id, this.props.emojiName);
    }

    removeReaction(e) {
        e.preventDefault();
        PostActions.removeReaction(this.props.post.channel_id, this.props.post.id, this.props.emojiName);
    }

    render() {
        if (!EmojiStore.has(this.props.emojiName)) {
            return null;
        }

        let currentUserReacted = false;
        const users = [];
        for (const reaction of this.props.reactions) {
            if (reaction.user_id === this.props.currentUserId) {
                currentUserReacted = true;
            } else {
                users.push(Utils.displayUsername(reaction.user_id));
            }
        }

        // sort users in alphabetical order with "you" being first if the current user reacted
        users.sort();
        if (currentUserReacted) {
            users.unshift(Utils.localizeMessage('reaction.you', 'You'));
        }

        let tooltip;
        if (users.length > 1) {
            tooltip = (
                <FormattedHTMLMessage
                    id='reaction.multipleReacted'
                    defaultMessage='<b>{users} and {lastUser}</b> reacted with <b>:{emojiName}:</b>'
                    values={{
                        users: users.slice(0, -1).join(', '),
                        lastUser: users[users.length - 1],
                        emojiName: this.props.emojiName
                    }}
                />
            );
        } else {
            tooltip = (
                <FormattedHTMLMessage
                    id='reaction.oneReacted'
                    defaultMessage='<b>{user}</b> reacted with <b>:{emojiName}:</b>'
                    values={{
                        user: users[0],
                        emojiName: this.props.emojiName
                    }}
                />
            );
        }

        let handleClick;
        let clickTooltip;
        let className = 'post-reaction';
        if (currentUserReacted) {
            handleClick = this.removeReaction;
            clickTooltip = (
                <FormattedMessage
                    id='reaction.clickToRemove'
                    defaultMessage='(click to remove)'
                />
            );

            className += ' post-reaction--current-user';
        } else {
            handleClick = this.addReaction;
            clickTooltip = (
                <FormattedMessage
                    id='reaction.clickToAdd'
                    defaultMessage='(click to add)'
                />
            );
        }

        return (
            <OverlayTrigger
                delayShow={1000}
                placement='top'
                shouldUpdatePosition={true}
                overlay={
                    <Tooltip>
                        {tooltip}
                        <br/>
                        {clickTooltip}
                    </Tooltip>
                }
            >
                <div
                    className={className}
                    onClick={handleClick}
                >
                    <img
                        className='post-reaction__emoji'
                        src={EmojiStore.getEmojiImageUrl(EmojiStore.get(this.props.emojiName))}
                    />
                    <span className='post-reaction__count'>
                        {this.props.reactions.length}
                    </span>
                </div>
            </OverlayTrigger>
        );
    }
}
