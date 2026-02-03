// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {Reaction as ReactionType} from '@mattermost/types/reactions';

import ReactionTooltip from './reaction_tooltip';

import './reaction.scss';

type State = {
    displayNumber: number;
    reactedClass: 'Reaction--reacted' | 'Reaction--reacting' | 'Reaction--unreacted' | 'Reaction--unreacting';
};

type Props = WrappedComponentProps & {

    /*
     * The post to render the reaction for
     */
    post: Post;

    /*
     * The name of the emoji for the reaction
     */
    emojiName: string;

    /*
     * The number of reactions to this post for this emoji
     */
    reactionCount: number;

    /*
     * Array of reactions by user
     */
    reactions: ReactionType[];

    /*
     * True if the user has the permission to add a reaction in this channel
     */
    canAddReactions: boolean;

    /*
     * True if user has the permission to remove his own reactions in this channel
     */
    canRemoveReactions: boolean;

    /*
     * The URL of the emoji image
     */
    emojiImageUrl: string;

    /*
     * Whether or not the current user has used this reaction
     */
    currentUserReacted: boolean;

    actions: {

        /*
         * Function to add a reaction to a post
         */
        addReaction: (postId: string, emojiName: string) => void;

        /*
         * Function to get non-loaded profiles by id
         */
        getMissingProfilesByIds: (ids: string[]) => void;

        /*
         * Function to remove a reaction from a post
         */
        removeReaction: (postId: string, emojiName: string) => void;
    };

    // Names of users for tooltip-like aria label, computed via selector
    users?: string[];

}

export class Reaction extends React.PureComponent<Props, State> {
    private reactionButtonRef = React.createRef<HTMLButtonElement>();
    private reactionCountRef = React.createRef<HTMLSpanElement>();
    private animating = false;

    constructor(props: Props) {
        super(props);

        const {currentUserReacted, reactionCount} = this.props;

        if (currentUserReacted) {
            this.state = {
                reactedClass: 'Reaction--reacted',
                displayNumber: reactionCount,
            };
        } else {
            this.state = {
                reactedClass: 'Reaction--unreacted',
                displayNumber: reactionCount,
            };
        }
    }

    componentDidUpdate(prevProps: Props): void {
        if (prevProps.reactionCount !== this.props.reactionCount) {
            const {currentUserReacted} = this.props;
            const reactedClass = currentUserReacted ? 'Reaction--reacted' : 'Reaction--unreacted';

            this.animating = false;
            this.setState({
                displayNumber: this.props.reactionCount,
                reactedClass,
            });
        }
    }

    handleClick = (): void => {
        // only proceed if user has permission to react
        // and we are not animating
        if (
            !(this.props.canAddReactions && this.props.canRemoveReactions) || this.animating
        ) {
            return;
        }

        const {currentUserReacted} = this.props;

        this.animating = true;
        this.setState((state) => {
            if (currentUserReacted) {
                return {
                    displayNumber: state.displayNumber - 1,
                    reactedClass: 'Reaction--unreacting',
                };
            }

            return {
                displayNumber: state.displayNumber + 1,
                reactedClass: 'Reaction--reacting',
            };
        });
    };

    handleAnimationEnded = (): void => {
        const {actions, currentUserReacted, post, emojiName} = this.props;

        this.animating = false;
        this.setState<'reactedClass'>((state) => {
            if (state.reactedClass === 'Reaction--reacting') {
                return {
                    reactedClass: 'Reaction--reacted',
                };
            } else if (state.reactedClass === 'Reaction--unreacting') {
                return {
                    reactedClass: 'Reaction--unreacted',
                };
            }
            return state;
        });

        if (currentUserReacted) {
            actions.removeReaction(post.id, emojiName);
        } else {
            actions.addReaction(post.id, emojiName);
        }
    };

    loadMissingProfiles = async (): Promise<void> => {
        const ids = this.props.reactions.map((reaction) => reaction.user_id);
        this.props.actions.getMissingProfilesByIds(ids);
    };

    render(): React.ReactNode {
        if (!this.props.emojiImageUrl) {
            return null;
        }
        const {
            canAddReactions,
            canRemoveReactions,
            currentUserReacted,
            emojiName,
            reactionCount,
            reactions,
            users = [],
            intl,
        } = this.props;
        const {displayNumber} = this.state;
        const reactedNumber = currentUserReacted ? reactionCount : reactionCount + 1;
        const unreactedNumber = currentUserReacted ? reactionCount - 1 : reactionCount;
        const unreacted = (unreactedNumber > 0) ? unreactedNumber : '';
        const reacted = (reactedNumber > 0) ? reactedNumber : '';
        const display = (displayNumber > 0) ? displayNumber : '';
        const readOnlyClass = (canAddReactions && canRemoveReactions) ? '' : 'Reaction--read-only';

        const emojiNameWithSpaces = this.props.emojiName.replace(/_/g, ' ');
        let ariaLabelEmoji = `${emojiNameWithSpaces}`;

        // If intl/users are available, append the same sentence shown in the tooltip
        if (intl) {
            const otherUsersCount = reactions.length - users.length;

            let names: string | undefined;
            if (otherUsersCount > 0) {
                if (users.length > 0) {
                    names = intl.formatMessage(
                        {
                            id: 'reaction.usersAndOthersReacted',
                            defaultMessage: '{users} and {otherUsers, number} other {otherUsers, plural, one {user} other {users}}',
                        },
                        {
                            users: users.join(', '),
                            otherUsers: otherUsersCount,
                        },
                    );
                } else {
                    names = intl.formatMessage(
                        {
                            id: 'reaction.othersReacted',
                            defaultMessage: '{otherUsers, number} {otherUsers, plural, one {user} other {users}}',
                        },
                        {
                            otherUsers: otherUsersCount,
                        },
                    );
                }
            } else if (users.length > 1) {
                names = intl.formatMessage(
                    {
                        id: 'reaction.usersReacted',
                        defaultMessage: '{users} and {lastUser}',
                    },
                    {
                        users: users.slice(0, -1).join(', '),
                        lastUser: users[users.length - 1],
                    },
                );
            } else {
                names = users[0];
            }

            let reactionVerb: string;
            if (users.length + otherUsersCount > 1) {
                if (currentUserReacted) {
                    reactionVerb = intl.formatMessage({
                        id: 'reaction.reactionVerb.youAndUsers',
                        defaultMessage: 'reacted',
                    });
                } else {
                    reactionVerb = intl.formatMessage({
                        id: 'reaction.reactionVerb.users',
                        defaultMessage: 'reacted',
                    });
                }
            } else if (currentUserReacted) {
                reactionVerb = intl.formatMessage({
                    id: 'reaction.reactionVerb.you',
                    defaultMessage: 'reacted',
                });
            } else {
                reactionVerb = intl.formatMessage({
                    id: 'reaction.reactionVerb.user',
                    defaultMessage: 'reacted',
                });
            }

            const tooltipTitle = intl.formatMessage(
                {
                    id: 'reaction.reacted',
                    defaultMessage: '{users} {reactionVerb} with {emoji}',
                },
                {
                    users: names,
                    reactionVerb,
                    emoji: ':' + emojiName + ':',
                },
            );

            let tooltipHint: string | undefined;
            if (currentUserReacted && canRemoveReactions) {
                tooltipHint = intl.formatMessage({
                    id: 'reaction.a11y.clickToRemove',
                    defaultMessage: 'Click to remove.',
                });
            } else if (!currentUserReacted && canAddReactions) {
                tooltipHint = intl.formatMessage({
                    id: 'reaction.a11y.clickToAdd',
                    defaultMessage: 'Click to add.',
                });
            }

            ariaLabelEmoji = tooltipHint ? `${tooltipTitle}. ${tooltipHint}` : tooltipTitle;
        }

        const emojiIcon = (
            <img
                className='Reaction__emoji emoticon'
                src={this.props.emojiImageUrl}
                alt=''
                aria-hidden={true}
            />
        );

        return (
            <ReactionTooltip
                canAddReactions={canAddReactions}
                canRemoveReactions={canRemoveReactions}
                currentUserReacted={currentUserReacted}
                emojiName={emojiName}
                reactions={reactions}
                onShow={this.loadMissingProfiles}
            >
                <button
                    id={`postReaction-${this.props.post.id}-${this.props.emojiName}`}
                    aria-label={ariaLabelEmoji}
                    className={`Reaction ${this.state.reactedClass} ${readOnlyClass}`}
                    onClick={this.handleClick}
                    ref={this.reactionButtonRef}
                >
                    <span className='d-flex align-items-center'>
                        {emojiIcon}
                        <span
                            ref={this.reactionCountRef}
                            className='Reaction__count'
                        >
                            <span className='Reaction__number'>
                                <span className='Reaction__number--display'>{display}</span>
                                <span
                                    className='Reaction__number--unreacted'
                                    onAnimationEnd={this.handleAnimationEnded}
                                >
                                    {unreacted}
                                </span>
                                <span className='Reaction__number--reacted'>{reacted}</span>
                            </span>
                        </span>
                    </span>
                </button>
            </ReactionTooltip>
        );
    }
}

export default injectIntl(Reaction);
