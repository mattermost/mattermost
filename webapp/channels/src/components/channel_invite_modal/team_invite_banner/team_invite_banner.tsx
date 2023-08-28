// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';

import {Permissions} from 'mattermost-redux/constants';

import {UserProfile} from '@mattermost/types/users';

import {Value} from 'components/multiselect/multiselect';
import AlertBanner from 'components/alert_banner';
import Markdown from 'components/markdown';
import SimpleTooltip from 'components/widgets/simple_tooltip';

import {MentionKey} from 'utils/text_formatting';
import {GlobalState} from '@mattermost/types/store';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';

import {t} from 'utils/i18n';

type UserProfileValue = Value & UserProfile;

export type Props = {
    teamId: string;
    users: UserProfileValue[];
    guests: UserProfileValue[];
}

const TeamInviteBanner = (props: Props) => {
    const {
        teamId,
        users,
        guests,
    } = props;

    const {formatMessage} = useIntl();

    const team = useSelector((state: GlobalState) => getTeam(state, teamId));
    const canAddUsersToTeam = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.ADD_USER_TO_TEAM));

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
    }, [guests]);

    const getMessage = useCallback((userprofiles: Array<UserProfileValue | UserProfile>) => {
        const mentionKeys = getMentionKeys(userprofiles);
        const commaSeparatedUsernames = getCommaSeparatedUsernames(userprofiles);
        const firstName = userprofiles[0].username;
        const lastName = userprofiles[userprofiles.length - 1].username;

        if (userprofiles.length > 10) {
            const formattedMessage = {
                id: t('channel_invite.invite_team_members.messageOverflow'),
                defaultMessage: '{firstUser} and {others} were not selected. Please contact your system administrator to add them to the **{team}** team before you can add them to this channel.',
            };

            return formatMessage(
                formattedMessage,
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
                                        count: userprofiles.length - 1,
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
            defaultMessage: '{count, plural, =1 {{firstUser} was} other {{users} and {lastUser} were}} not selected. Please contact your system administrator to add them to the **{team}** team before you can add them to this channel.',

        };

        const message: string = formatMessage(
            formattedMessage,
            {
                count: userprofiles.length,
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
    }, [getMentionKeys, getCommaSeparatedUsernames, canAddUsersToTeam, team, formatMessage]);


    return (
        <>
            {
                (users.length > 0 || guests.length > 0) &&
                <AlertBanner
                    id='inviteMembersToTeamBanner'
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
                        getMessage(users)
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

export default React.memo(TeamInviteBanner);
