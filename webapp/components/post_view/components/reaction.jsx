// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import EmojiStore from 'stores/emoji_store.jsx';

import * as Utils from 'utils/utils.jsx';

export default class Reaction extends React.Component {
    static propTypes = {
        post: React.PropTypes.object.isRequired,
        currentUserId: React.PropTypes.string.isRequired,
        emojiName: React.PropTypes.string.isRequired,
        reactions: React.PropTypes.arrayOf(React.PropTypes.object),
        emojis: React.PropTypes.object.isRequired,
        profiles: React.PropTypes.array.isRequired,
        otherUsers: React.PropTypes.number.isRequired,
        actions: React.PropTypes.shape({
            addReaction: React.PropTypes.func.isRequired,
            getMissingProfiles: React.PropTypes.func.isRequired,
            removeReaction: React.PropTypes.func.isRequired
        })
    }

    constructor(props) {
        super(props);

        this.addReaction = this.addReaction.bind(this);
        this.removeReaction = this.removeReaction.bind(this);
    }

    addReaction(e) {
        e.preventDefault();
        this.props.actions.addReaction(this.props.post.channel_id, this.props.post.id, this.props.emojiName);
    }

    removeReaction(e) {
        e.preventDefault();
        this.props.actions.removeReaction(this.props.post.channel_id, this.props.post.id, this.props.emojiName);
    }

    render() {
        if (!this.props.emojis.has(this.props.emojiName)) {
            return null;
        }

        let currentUserReacted = false;
        const users = [];
        const otherUsers = this.props.otherUsers;
        for (const user of this.props.profiles) {
            if (user.id === this.props.currentUserId) {
                currentUserReacted = true;
            } else {
                users.push(Utils.displayUsernameForUser(user));
            }
        }

        // Sort users in alphabetical order with "you" being first if the current user reacted
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
                onEnter={this.props.actions.getMissingProfiles}
            >
                <div
                    className={className}
                    onClick={handleClick}
                >
                    <span
                        className='post-reaction__emoji emoticon'
                        style={{backgroundImage: 'url(' + EmojiStore.getEmojiImageUrl(this.props.emojis.get(this.props.emojiName)) + ')'}}
                    />
                    <span className='post-reaction__count'>
                        {this.props.reactions.length}
                    </span>
                </div>
            </OverlayTrigger>
        );
    }
}
