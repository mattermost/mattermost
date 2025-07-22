// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {sendAddToChannelEphemeralPost} from 'actions/global_actions';

import AtMention from 'components/at_mention';

import {Constants} from 'utils/constants';

interface Actions {
    addChannelMember: (channelId: string, userId: string, rootId: string) => void;
    removePost: (post: Post) => void;
}

export interface Props {
    currentUser: UserProfile;
    channelType: string;
    postId: string;
    post: Post;
    userIds: string[];
    usernames: string[];
    noGroupsUsernames: string[];
    isPolicyEnforced: boolean;
    actions: Actions;
}

interface State {
    expanded: boolean;
}

export default class PostAddChannelMember extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            expanded: false,
        };
    }

    handleAddChannelMember = () => {
        const {currentUser, post, userIds, usernames} = this.props;

        if (post && post.channel_id) {
            let createAt = post.create_at;
            userIds.forEach((userId, index) => {
                createAt++;
                this.props.actions.addChannelMember(post.channel_id, userId, post.root_id);
                sendAddToChannelEphemeralPost(currentUser, usernames[index], userId, post.channel_id, post.root_id, createAt);
            });

            this.props.actions.removePost(post);
        }
    };

    expand = () => {
        this.setState({expanded: true});
    };

    generateAtMentions(usernames = [] as string[]) {
        if (usernames.length === 1) {
            return (
                <AtMention
                    mentionName={usernames[0]}
                    channelId={this.props.post?.channel_id}
                />
            );
        } else if (usernames.length > 1) {
            function andSeparator(key: number) {
                return (
                    <FormattedMessage
                        key={key}
                        id={'post_body.check_for_out_of_channel_mentions.link.and'}
                        defaultMessage={' and '}
                    />
                );
            }

            function commaSeparator(key: number) {
                return <span key={key}>{', '}</span>;
            }

            if (this.state.expanded || usernames.length <= 3) {
                return (
                    <span>
                        {
                            usernames.map((username) => {
                                return (
                                    <AtMention
                                        key={username}
                                        mentionName={username}
                                        channelId={this.props.post?.channel_id}
                                    />
                                );
                            }).reduce((acc, el, idx, arr) => {
                                if (idx === 0) {
                                    return [el];
                                } else if (idx === arr.length - 1) {
                                    return [...acc, andSeparator(idx), el];
                                }

                                return [...acc, commaSeparator(idx), el];
                            }, [] as JSX.Element[])
                        }
                    </span>
                );
            }
            const otherUsers = [...usernames];
            const firstUserName = otherUsers.shift() as string; // will never be undefined
            const lastUserName = otherUsers.pop() as string; // will never be undefined
            return (
                <span>
                    <AtMention
                        key={firstUserName}
                        mentionName={firstUserName}
                        channelId={this.props.post?.channel_id}
                    />
                    {commaSeparator(1)}
                    <a
                        className='PostBody_otherUsersLink'
                        onClick={this.expand}
                    >
                        <FormattedMessage
                            id={'post_body.check_for_out_of_channel_mentions.others'}
                            defaultMessage={'{numOthers} others'}
                            values={{
                                numOthers: otherUsers.length,
                            }}
                        />
                    </a>
                    {andSeparator(1)}
                    <AtMention
                        key={lastUserName}
                        mentionName={lastUserName}
                        channelId={this.props.post?.channel_id}
                    />
                </span>
            );
        }

        return '';
    }

    render() {
        const {channelType, postId, usernames, noGroupsUsernames, isPolicyEnforced} = this.props;
        if (!postId || !channelType) {
            return null;
        }

        // For ABAC channels (policy enforced), NEVER show invite links - only show notification message
        if (isPolicyEnforced) {
            // Combine all users into a single message without any invite functionality
            const allUsers = [...usernames, ...noGroupsUsernames];
            const allUsersAtMentions = this.generateAtMentions(allUsers);

            if (allUsers.length === 0) {
                return null;
            }

            const messageText = 'did not get notified by this mention because they are not in the channel.';

            return (
                <p>
                    {allUsersAtMentions}
                    {' '}
                    {messageText}
                </p>
            );
        }

        // Regular flow for non-ABAC channels
        let link;
        if (channelType === Constants.PRIVATE_CHANNEL) {
            link = (
                <FormattedMessage
                    id='post_body.check_for_out_of_channel_mentions.link.private'
                    defaultMessage='add them to this private channel'
                />
            );
        } else if (channelType === Constants.OPEN_CHANNEL) {
            link = (
                <FormattedMessage
                    id='post_body.check_for_out_of_channel_mentions.link.public'
                    defaultMessage='add them to the channel'
                />
            );
        }

        // Separate invitable users from group-constrained users
        const invitableUsers = usernames.filter((username) => !noGroupsUsernames.includes(username));
        const outOfGroupsUsers = noGroupsUsernames;

        const messages = [];

        // Handle invitable users with invite functionality
        if (invitableUsers.length > 0) {
            const invitableAtMentions = this.generateAtMentions(invitableUsers);
            const invitableMessagePart = invitableUsers.length === 1 ? (
                <FormattedMessage
                    id='post_body.check_for_out_of_channel_mentions.message.one'
                    defaultMessage='did not get notified by this mention because they are not in the channel. Would you like to '
                />
            ) : (
                <FormattedMessage
                    id='post_body.check_for_out_of_channel_mentions.message.multiple'
                    defaultMessage='did not get notified by this mention because they are not in the channel. Would you like to '
                />
            );

            messages.push(
                <p key='invitable'>
                    {invitableAtMentions}
                    {' '}
                    {invitableMessagePart}
                    <a
                        className='PostBody_addChannelMemberLink'
                        onClick={this.handleAddChannelMember}
                    >
                        {link}
                    </a>
                    <FormattedMessage
                        id='post_body.check_for_out_of_channel_mentions.message_last'
                        defaultMessage='? They will have access to all message history.'
                    />
                </p>,
            );
        }

        // Handle users not in required groups with specific messaging
        if (outOfGroupsUsers.length > 0) {
            const outOfGroupsAtMentions = this.generateAtMentions(outOfGroupsUsers);
            const outOfGroupsMessagePart = (
                <FormattedMessage
                    id='post_body.check_for_out_of_channel_groups_mentions.message'
                    defaultMessage='did not get notified by this mention because they are not in the channel. They cannot be added to the channel because they are not a member of the linked groups. To add them to this channel, they must be added to the linked groups.'
                />
            );

            messages.push(
                <p key='out-of-groups'>
                    {outOfGroupsAtMentions}
                    {' '}
                    {outOfGroupsMessagePart}
                </p>,
            );
        }

        return (
            <>
                {messages}
            </>
        );
    }
}
