// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, FormattedList, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getTeam} from 'mattermost-redux/selectors/entities/teams';

import AlertBanner from 'components/alert_banner';
import AtMention from 'components/at_mention';
import type {Value} from 'components/multiselect/multiselect';
import SimpleTooltip from 'components/widgets/simple_tooltip';

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

    const getCommaSeparatedUsernames = useCallback((users: Array<UserProfileValue | UserProfile>) => {
        return users.map((user) => {
            return `@${user.username}`;
        }).join(', ');
    }, []);

    const getGuestMessage = useCallback(() => {
        if (guests.length === 0) {
            return null;
        }

        const commaSeparatedUsernames = getCommaSeparatedUsernames(guests);
        const firstName = guests[0].username;
        if (guests.length > 10) {
            return (
                formatMessage(
                    {
                        id: 'channel_invite.invite_team_members.guests.messageOverflow',
                        defaultMessage: '{firstUser} and {others} are guest users and need to first be invited to the team before you can add them to the channel. Once they\'ve joined the team, you can add them to this channel.',
                    },
                    {
                        firstUser: (
                            <AtMention
                                key={firstName}
                                mentionName={firstName}
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

        const guestsList = guests.map((user) => {
            return (
                <AtMention
                    key={user.username}
                    mentionName={user.username}
                />
            );
        });

        return (
            formatMessage(
                {
                    id: 'channel_invite.invite_team_members.guests.message',
                    defaultMessage: '{count, plural, =1 {{firstUser} is a guest user and needs} other {{users} are guest users and need}} to first be invited to the team before you can add them to the channel. Once they\'ve joined the team, you can add them to this channel.',
                },
                {
                    count: guests.length,
                    users: (<FormattedList value={guestsList}/>),
                    firstUser: (
                        <AtMention
                            key={firstName}
                            mentionName={firstName}
                        />
                    ),
                    team: (<strong>{team?.display_name}</strong>),
                },
            )
        );
    }, [guests, formatMessage, getCommaSeparatedUsernames, team?.display_name]);

    const getMessage = useCallback(() => {
        const commaSeparatedUsernames = getCommaSeparatedUsernames(users);
        const firstName = users[0].username;

        if (users.length > 10) {
            return formatMessage(
                {
                    id: 'channel_invite.invite_team_members.messageOverflow',
                    defaultMessage: 'You can add {firstUser} and {others} to this channel once they are members of the {team} team.',
                },
                {
                    firstUser: (
                        <AtMention
                            key={firstName}
                            mentionName={firstName}
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
                    team: (<strong>{team?.display_name}</strong>),
                },
            );
        }

        const usersList = users.map((user) => {
            return (
                <AtMention
                    key={user.username}
                    mentionName={user.username}
                />
            );
        });

        return (
            formatMessage(
                {
                    id: 'channel_invite.invite_team_members.message',
                    defaultMessage: 'You can add {count, plural, =1 {{firstUser}} other {{users}}} to this channel once they are members of the {team} team.',
                },
                {
                    count: users.length,
                    users: (<FormattedList value={usersList}/>),
                    firstUser: (
                        <AtMention
                            key={firstName}
                            mentionName={firstName}
                        />
                    ),
                    team: (<strong>{team?.display_name}</strong>),
                },
            )
        );
    }, [users, getCommaSeparatedUsernames, team, formatMessage]);

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
