// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {Reaction as ReactionType} from '@mattermost/types/reactions';

import WithTooltip from 'components/with_tooltip';

type Props = {
    canAddReactions: boolean;
    canRemoveReactions: boolean;
    children: React.ReactNode;
    currentUserReacted: boolean;
    emojiName: string;
    id: string;
    onShow: () => void;
    reactions: ReactionType[];
    users: string[];
};

const ReactionTooltip: React.FC<Props> = (props: Props) => {
    const {
        canAddReactions,
        canRemoveReactions,
        children,
        currentUserReacted,
        emojiName,
        id,
        onShow,
        reactions,
        users,
    } = props;

    const intl = useIntl();

    const otherUsersCount = reactions.length - users.length;

    let names;
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

    let reactionVerb;
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

    const tooltip = intl.formatMessage(
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

    let clickTooltip;
    if (currentUserReacted && canRemoveReactions) {
        clickTooltip = intl.formatMessage({
            id: 'reaction.clickToRemove',
            defaultMessage: '(click to remove)',
        });
    } else if (!currentUserReacted && canAddReactions) {
        clickTooltip = intl.formatMessage({
            id: 'reaction.clickToAdd',
            defaultMessage: '(click to add)',
        });
    }

    return (
        <WithTooltip
            id={id}
            emoji={emojiName}
            emojiStyle='large'
            placement='top'
            title={tooltip}
            hint={clickTooltip}
            onShow={onShow}
        >
            {children}
        </WithTooltip>
    );
};

export default ReactionTooltip;
