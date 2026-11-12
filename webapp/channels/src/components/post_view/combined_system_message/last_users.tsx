// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {defineMessage, defineMessages, injectIntl} from 'react-intl';
import type {IntlShape, MessageDescriptor} from 'react-intl';

import {Posts} from 'mattermost-redux/constants';
import {secureGetFromRecord} from 'mattermost-redux/utils/post_utils';

import Markdown from 'components/markdown';

import type {KindMessages} from 'utils/channel_kind';
import type {TextFormattingOptions} from 'utils/text_formatting';

import type {ChannelKind} from 'types/store/plugins';

// Channel post types, one message per kind of channel.
/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
const channelTypeMessage = {
    [Posts.POST_TYPES.ADD_TO_CHANNEL]: {
        channel: defineMessage({
            id: 'last_users_message.added_to_channel.type',
            defaultMessage: 'were **added to the channel** by {actor}.',
        }),
        board: defineMessage({
            id: 'last_users_message.added_to_channel.type.board',
            defaultMessage: 'were **added to the board** by {actor}.',
        }),
    },
    [Posts.POST_TYPES.JOIN_CHANNEL]: {
        channel: defineMessage({
            id: 'last_users_message.joined_channel.type',
            defaultMessage: '**joined the channel**.',
        }),
        board: defineMessage({
            id: 'last_users_message.joined_channel.type.board',
            defaultMessage: '**joined the board**.',
        }),
    },
    [Posts.POST_TYPES.LEAVE_CHANNEL]: {
        channel: defineMessage({
            id: 'last_users_message.left_channel.type',
            defaultMessage: '**left the channel**.',
        }),
        board: defineMessage({
            id: 'last_users_message.left_channel.type.board',
            defaultMessage: '**left the board**.',
        }),
    },
    [Posts.POST_TYPES.JOIN_LEAVE_CHANNEL]: {
        channel: defineMessage({
            id: 'last_users_message.joined_left_channel.type',
            defaultMessage: '**joined and left the channel**.',
        }),
        board: defineMessage({
            id: 'last_users_message.joined_left_channel.type.board',
            defaultMessage: '**joined and left the board**.',
        }),
    },
    [Posts.POST_TYPES.REMOVE_FROM_CHANNEL]: {
        channel: defineMessage({
            id: 'last_users_message.removed_from_channel.type',
            defaultMessage: 'were **removed from the channel**.',
        }),
        board: defineMessage({
            id: 'last_users_message.removed_from_channel.type.board',
            defaultMessage: 'were **removed from the board**.',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */

const teamTypeMessage = defineMessages({
    [Posts.POST_TYPES.ADD_TO_TEAM]: {
        id: 'last_users_message.added_to_team.type',
        defaultMessage: 'were **added to the team** by {actor}.',
    },
    [Posts.POST_TYPES.JOIN_TEAM]: {
        id: 'last_users_message.joined_team.type',
        defaultMessage: '**joined the team**.',
    },
    [Posts.POST_TYPES.LEAVE_TEAM]: {
        id: 'last_users_message.left_team.type',
        defaultMessage: '**left the team**.',
    },
    [Posts.POST_TYPES.REMOVE_FROM_TEAM]: {
        id: 'last_users_message.removed_from_team.type',
        defaultMessage: 'were **removed from the team**.',
    },
});

type Props = {
    actor?: string;
    channelKind?: ChannelKind;
    expandedLocale: MessageDescriptor;
    formatOptions: Partial<TextFormattingOptions>;
    intl: IntlShape;
    postType: string;
    usernames: string[];
};

type State = {
    expand: boolean;
};

export class LastUsers extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            expand: false,
        };
    }

    handleOnClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        e.preventDefault();

        this.setState({expand: true});
    };

    renderMessage = (formattedMessage: string): JSX.Element => {
        return (
            <Markdown
                message={formattedMessage}
                options={this.props.formatOptions}
            />
        );
    };

    render(): JSX.Element {
        const {formatMessage} = this.props.intl;
        const {expand} = this.state;
        const {
            actor,
            channelKind = 'channel',
            expandedLocale,
            postType,
            usernames,
        } = this.props;

        const firstUser = usernames[0];
        const lastIndex = usernames.length - 1;
        const lastUser = usernames[lastIndex];

        if (expand) {
            const formattedMessage = formatMessage(expandedLocale, {
                users: usernames.slice(0, lastIndex).join(', '),
                lastUser,
                actor,
            });

            return this.renderMessage(formattedMessage);
        }

        const firstUserMessage = formatMessage(
            {id: 'last_users_message.first', defaultMessage: '{firstUser} and '},
            {firstUser},
        );

        const otherUsersMessage = formatMessage(
            {id: 'last_users_message.others', defaultMessage: '{numOthers} others '},
            {numOthers: lastIndex},
        );

        const selectedTypeMessage = secureGetFromRecord(channelTypeMessage, postType)?.[channelKind] ?? secureGetFromRecord(teamTypeMessage, postType);

        const actorMessage = selectedTypeMessage ? formatMessage(
            {id: selectedTypeMessage.id, defaultMessage: selectedTypeMessage.defaultMessage},
            {actor},
        ) : '';

        return (
            <span>
                {this.renderMessage(firstUserMessage)}
                <a onClick={this.handleOnClick}>
                    {otherUsersMessage}
                </a>
                {this.renderMessage(actorMessage)}
            </span>
        );
    }
}
export default injectIntl(LastUsers);
