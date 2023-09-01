// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';

import {Value} from 'components/multiselect/multiselect';
import AlertBanner from 'components/alert_banner';
import Markdown from 'components/markdown';
import SimpleTooltip from 'components/widgets/simple_tooltip';

import {MentionKey} from 'utils/text_formatting';
import {GlobalState} from '@mattermost/types/store';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import {t} from 'utils/i18n';

type UserProfileValue = Value & UserProfile;

export type Props = {
    teamId: string;
    users: UserProfileValue[];
    guests: UserProfileValue[];
}

const TeamWarningBanner = (props: Props) => {
    const {
        teamId,
        users,
        guests,
    } = props;

    const {formatMessage} = useIntl();

    const team = useSelector((state: GlobalState) => getTeam(state, teamId));

    const getMentionKeys = useCallback((users: Array<UserProfileValue | UserProfile>) => {
        const mentionKeys: MentionKey[] = [];
        for (const user of users) {
            mentionKeys.push({key: `@${user.username}`});
        }
        return mentionKeys;
    }, []);

    const getCommaSeparatedUsernames = useCallback((users: Array<UserProfileValue | UserProfile>) => {
        return users.map((user) => {
            return `@${user.username}`;
        }).join(', ');
    }, []);

    const getGuestMessage = useCallback(() => {
        if (guests.length === 0) {
            return null;
        }

        const mentionKeys = getMentionKeys(guests);
        const commaSeparatedUsernames = getCommaSeparatedUsernames(guests);
        const firstName = guests[0].username;
        const lastName = guests[guests.length - 1].username;
        if (guests.length > 10) {
            return (
                formatMessage(
                    {
                        id: t('channel_invite.invite_team_members.guests.messageOverflow'),
                        defaultMessage: '{firstUser} and {others} are guest users and need to first be invited to the team before you can add them to the channel. Once they\'ve joined the team, you can add them to this channel.',
                    },
                    {
                        firstUser: (
                            <Markdown
                                message={`@${firstName}`}
                                options={{
                                    atMentions: true,
                                    mentionKeys,
                                    mentionHighlight: false,
                                    singleline: true,
                                }}
                            />
                        ),
                        others: (
                            <SimpleTooltip
                                id={'usernames-overflow'}
                                content={commaSeparatedUsernames.replace(`@${firstName}, `, '')}
                            >
                                <span
                                    className='add-others-link'
                                >
                                    <FormattedMessage
                                        id='channel_invite.invite_team_members.messageOthers'
                                        defaultMessage='{count} others'
                                        values={{
                                            count: guests.length - 1,
                                        }}
                                    />
                                </span>
                            </SimpleTooltip>
                        ),
                    },
                )
            );
        }

        const message: string = formatMessage(
            {
                id: t('channel_invite.invite_team_members.guests.message'),
                defaultMessage: '{count, plural, =1 {{firstUser} is a guest user and needs} other {{users} and {lastUser} are guest users and need}} to first be invited to the team before you can add them to the channel. Once they\'ve joined the team, you can add them to this channel.',
            },
            {
                count: guests.length,
                users: commaSeparatedUsernames.replace(`, @${lastName}`, ''),
                firstUser: `@${firstName}`,
                lastUser: `@${lastName}`,
                team: team.display_name,
            },
        );

        return (
            <Markdown
                message={message}
                options={{
                    atMentions: true,
                    mentionKeys,
                    mentionHighlight: false,
                    singleline: true,
                }}
            />
        );
    }, [guests, formatMessage, getCommaSeparatedUsernames, getMentionKeys, team.display_name]);

    const getMessage = useCallback(() => {
        const mentionKeys = getMentionKeys(users);
        const commaSeparatedUsernames = getCommaSeparatedUsernames(users);
        const firstName = users[0].username;
        const lastName = users[users.length - 1].username;

        if (users.length > 10) {
            return formatMessage(
                {
                    id: t('channel_invite.invite_team_members.messageOverflow'),
                    defaultMessage: 'You can add {firstUser} and {others} to this channel once they are members of the **{team}** team.',
                },
                {
                    firstUser: (
                        <Markdown
                            message={`@${firstName}`}
                            options={{
                                atMentions: true,
                                mentionKeys,
                                mentionHighlight: false,
                                singleline: true,
                            }}
                        />
                    ),
                    others: (
                        <SimpleTooltip
                            id={'usernames-overflow'}
                            content={commaSeparatedUsernames.replace(`@${firstName}, `, '')}
                        >
                            <span
                                className='add-others-link'
                            >
                                <FormattedMessage
                                    id='channel_invite.invite_team_members.messageOthers'
                                    defaultMessage='{count} others'
                                    values={{
                                        count: users.length - 1,
                                    }}
                                />
                            </span>
                        </SimpleTooltip>
                    ),
                    team: team.display_name,
                },
            );
        }

        const formattedMessage = {
            id: t('channel_invite.invite_team_members.message'),
            defaultMessage: 'You can add {count, plural, =1 {{firstUser}} other {{users} and {lastUser}}} to this channel once they are members of the **{team}** team.',
        };

        const message: string = formatMessage(
            formattedMessage,
            {
                count: users.length,
                users: commaSeparatedUsernames.replace(`, @${lastName}`, ''),
                firstUser: `@${firstName}`,
                lastUser: `@${lastName}`,
                team: team.display_name,
            },
        );

        return (
            <Markdown
                message={message}
                options={{
                    atMentions: true,
                    mentionKeys,
                    mentionHighlight: false,
                    singleline: true,
                }}
            />
        );
    }, [users, getMentionKeys, getCommaSeparatedUsernames, team, formatMessage]);

    return (
        <>
            {
                (users.length > 0 || guests.length > 0) &&
                <AlertBanner
                    id='teamWarningBanner'
                    mode='warning'
                    variant='app'
                    title={
                        <FormattedMessage
                            id='channel_invite.invite_team_members.title'
                            defaultMessage='{count, plural, =1 {1 user was} other {# users were}} not selected because they are not a part of this team'
                            values={{
                                count: users.length + guests.length,
                            }}
                        />
                    }
                    message={
                        users.length > 0 &&
                        getMessage()
                    }
                    footerMessage={
                        guests.length > 0 &&
                        getGuestMessage()
                    }
                />
            }
        </>
    );
};

export default React.memo(TeamWarningBanner);
