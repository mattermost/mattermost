// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import EmojiStore from 'stores/emoji_store.jsx';
import * as PostActions from 'actions/post_actions.jsx';
import * as Utils from 'utils/utils.jsx';

import {FormattedMessage} from 'react-intl';
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
        let otherUsers = 0;
        for (const reaction of this.props.reactions) {
            if (reaction.user_id === this.props.currentUserId) {
                currentUserReacted = true;
            } else {
                const displayName = Utils.displayUsername(reaction.user_id);

                if (displayName) {
                    users.push(displayName);
                } else {
                    // Just count users that we don't have loaded
                    otherUsers += 1;
                }
            }
        }

        // sort users in alphabetical order with "you" being first if the current user reacted
        users.sort();
        if (currentUserReacted) {
            users.unshift(Utils.localizeMessage('reaction.you', 'You'));
        }

        let names;
        if (otherUsers > 0) {
            if (users.length > 0) {
                names = (
                    <FormattedMessage
                        id='reaction.usersAndOthersReacted'
                        defaultMessage='{users} and {otherUsers, number} other {otherUsers, plural, one {user} other {users}}'
                        values={{
                            users: users.join(', '),
                            otherUsers
                        }}
                    />
                );
            } else {
                names = (
                    <FormattedMessage
                        id='reaction.othersReacted'
                        defaultMessage='{otherUsers, number} {otherUsers, plural, one {user} other {users}}'
                        values={{
                            otherUsers
                        }}
                    />
                );
            }
        } else if (users.length > 1) {
            names = (
                <FormattedMessage
                    id='reaction.usersReacted'
                    defaultMessage='{users} and {lastUser}'
                    values={{
                        users: users.slice(0, -1).join(', '),
                        lastUser: users[users.length - 1]
                    }}
                />
            );
        } else {
            names = users[0];
        }

        let reactionVerb;
        if (users.length + otherUsers > 1) {
            if (currentUserReacted) {
                reactionVerb = (
                    <FormattedMessage
                        id='reaction.reactionVerb.youAndUsers'
                        defaultMessage='reacted'
                    />
                );
            } else {
                reactionVerb = (
                    <FormattedMessage
                        id='reaction.reactionVerb.users'
                        defaultMessage='reacted'
                    />
                );
            }
        } else if (currentUserReacted) {
            reactionVerb = (
                <FormattedMessage
                    id='reaction.reactionVerb.you'
                    defaultMessage='reacted'
                />
            );
        } else {
            reactionVerb = (
                <FormattedMessage
                    id='reaction.reactionVerb.user'
                    defaultMessage='reacted'
                />
            );
        }

        const tooltip = (
            <FormattedMessage
                id='reaction.reacted'
                defaultMessage='{users} {reactionVerb} with {emoji}'
                values={{
                    users: <b>{names}</b>,
                    reactionVerb,
                    emoji: <b>{':' + this.props.emojiName + ':'}</b>
                }}
            />
        );

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
                    <Tooltip id={`${this.props.post.id}-${this.props.emojiName}-reaction`}>
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
