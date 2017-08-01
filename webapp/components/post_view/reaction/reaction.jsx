// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils.jsx';

export default class Reaction extends React.PureComponent {
    static propTypes = {

        /*
         * The post to render the reaction for
         */
        post: PropTypes.object.isRequired,

        /*
         * The user id of the logged in user
         */
        currentUserId: PropTypes.string.isRequired,

        /*
         * The name of the emoji for the reaction
         */
        emojiName: PropTypes.string.isRequired,

        /*
         * The number of reactions to this post for this emoji
         */
        reactionCount: PropTypes.number.isRequired,

        /*
         * Array of users who reacted to this post
         */
        profiles: PropTypes.array.isRequired,

        /*
         * The number of users not in the profile list who have reacted with this emoji
         */
        otherUsersCount: PropTypes.number.isRequired,

        /*
         * Array of reactions by user
         */
        reactions: PropTypes.arrayOf(PropTypes.object).isRequired,

        /*
         * The URL of the emoji image
         */
        emojiImageUrl: PropTypes.string.isRequired,

        actions: PropTypes.shape({

            /*
             * Function to add a reaction to a post
             */
            addReaction: PropTypes.func.isRequired,

            /*
             * Function to get non-loaded profiles by id
             */
            getMissingProfilesByIds: PropTypes.func.isRequired,

            /*
             * Function to remove a reaction from a post
             */
            removeReaction: PropTypes.func.isRequired
        })
    }

    constructor(props) {
        super(props);

        this.addReaction = this.addReaction.bind(this);
        this.removeReaction = this.removeReaction.bind(this);
    }

    addReaction(e) {
        e.preventDefault();
        this.props.actions.addReaction(this.props.post.id, this.props.emojiName);
    }

    removeReaction(e) {
        e.preventDefault();
        this.props.actions.removeReaction(this.props.post.id, this.props.emojiName);
    }

    loadMissingProfiles = () => {
        const ids = this.props.reactions.map((reaction) => reaction.user_id);
        this.props.actions.getMissingProfilesByIds(ids);
    }

    render() {
        if (!this.props.emojiImageUrl) {
            return null;
        }

        let currentUserReacted = false;
        const users = [];
        const otherUsersCount = this.props.otherUsersCount;
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
        if (otherUsersCount > 0) {
            if (users.length > 0) {
                names = (
                    <FormattedMessage
                        id='reaction.usersAndOthersReacted'
                        defaultMessage='{users} and {otherUsers, number} other {otherUsers, plural, one {user} other {users}}'
                        values={{
                            users: users.join(', '),
                            otherUsers: otherUsersCount
                        }}
                    />
                );
            } else {
                names = (
                    <FormattedMessage
                        id='reaction.othersReacted'
                        defaultMessage='{otherUsers, number} {otherUsers, plural, one {user} other {users}}'
                        values={{
                            otherUsers: otherUsersCount
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
        if (users.length + otherUsersCount > 1) {
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
                trigger={['hover', 'focus']}
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
                onEnter={this.loadMissingProfiles}
            >
                <div
                    className={className}
                    onClick={handleClick}
                >
                    <span
                        className='post-reaction__emoji emoticon'
                        style={{backgroundImage: 'url(' + this.props.emojiImageUrl + ')'}}
                    />
                    <span className='post-reaction__count'>
                        {this.props.reactionCount}
                    </span>
                </div>
            </OverlayTrigger>
        );
    }
}
