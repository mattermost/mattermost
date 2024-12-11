// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {TeamMemberWithError, TeamInviteWithError} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {joinChannel} from 'mattermost-redux/actions/channels';
import * as TeamActions from 'mattermost-redux/actions/teams';
import {getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';
import {getTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import {addUsersToTeam} from 'actions/team_actions';

import type {InviteResult} from 'components/invitation_modal/result_table';
import type {InviteResults} from 'components/invitation_modal/result_view';

import {ConsolePages} from 'utils/constants';

import type {DispatchFunc, ActionFuncAsync} from 'types/store';

export function sendMembersInvites(teamId: string, users: UserProfile[], emails: string[]): ActionFuncAsync<InviteResults> {
    return async (dispatch, getState) => {
        if (users.length > 0) {
            await dispatch(TeamActions.getTeamMembersByIds(teamId, users.map((u) => u.id)));
        }
        const state = getState();
        const sent = [];
        const notSent = [];
        const usersToAdd = [];
        for (const user of users) {
            const member = getTeamMember(state, teamId, user.id);
            if (isGuest(user.roles)) {
                notSent.push({
                    user,
                    reason: defineMessage({
                        id: 'invite.members.user-is-guest',
                        defaultMessage: 'Contact your admin to make this guest a full member.',
                    }),
                });
            } else if (member) {
                notSent.push({
                    user,
                    reason: defineMessage({
                        id: 'invite.members.already-member',
                        defaultMessage: 'This person is already a team member.',
                    }),
                });
            } else {
                usersToAdd.push(user);
            }
        }
        if (usersToAdd.length > 0) {
            const response = await dispatch(addUsersToTeam(teamId, usersToAdd.map((u) => u.id)));
            const members = response.data || [];
            if (response.error) {
                for (const userToAdd of usersToAdd) {
                    notSent.push({user: userToAdd, reason: response.error.message});
                }
            } else {
                for (const userToAdd of usersToAdd) {
                    const memberWithError = members.find((m: TeamMemberWithError) => m.user_id === userToAdd.id && m.error);
                    if (memberWithError) {
                        notSent.push({
                            user: userToAdd,
                            reason: memberWithError.error.message,
                        });
                    } else {
                        sent.push({
                            user: userToAdd,
                            reason: defineMessage({
                                id: 'invite.members.added-to-team',
                                defaultMessage: 'This member has been added to the team.',
                            }),
                        });
                    }
                }
            }
        }
        if (emails.length > 0) {
            let response;
            try {
                response = await dispatch(TeamActions.sendEmailInvitesToTeamGracefully(teamId, emails));
            } catch (e) {
                response = {
                    data: emails.map((email) => ({
                        email,
                        error: {
                            error: defineMessage({
                                id: 'invite.members.unable-to-add-the-user-to-the-team',
                                defaultMessage: 'Unable to add the user to the team.',
                            }),
                        },
                    })) as unknown as TeamInviteWithError[],
                };
            }
            const invitesWithErrors = response.data || [];
            if (response.error) {
                if (response.error.server_error_id === 'app.email.rate_limit_exceeded.app_error') {
                    response.error.message = defineMessage({
                        id: 'invite.rate-limit-exceeded',
                        defaultMessage: 'Invite emails rate limit exceeded.',
                    });
                }
                for (const email of emails) {
                    notSent.push({
                        email,
                        reason: response.error.message,
                    });
                }
            } else {
                for (const email of emails) {
                    const inviteWithError = invitesWithErrors.find((i: TeamInviteWithError) => email.toLowerCase() === i.email && i.error);
                    if (inviteWithError && inviteWithError.error.id === 'api.team.invite_members.unable_to_send_email_with_defaults.app_error' && isCurrentUserSystemAdmin(state)) {
                        notSent.push({
                            email,
                            reason: defineMessage({
                                id: 'admin.environment.smtp.smtpFailure',
                                defaultMessage: 'SMTP is not configured in System Console. Can be configured <a>here</a>.',
                            }),
                            path: ConsolePages.SMTP,
                        });
                    } else if (inviteWithError) {
                        notSent.push({
                            email,
                            reason: inviteWithError.error.message,
                        });
                    } else {
                        sent.push({
                            email,
                            reason: defineMessage({
                                id: 'invite.members.invite-sent',
                                defaultMessage: 'An invitation email has been sent.',
                            }),
                        });
                    }
                }
            }
        }
        return {
            data: {
                sent,
                notSent,
            },
        };
    };
}

export async function sendGuestInviteForUser(
    dispatch: DispatchFunc,
    user: UserProfile,
    teamId: string,
    channels: Channel[],
    members: RelationOneToOne<Channel, Record<string, ChannelMembership>>,
): Promise<({sent: InviteResult} | {notSent: InviteResult})> {
    if (!isGuest(user.roles)) {
        return {
            notSent: {
                user,
                reason: defineMessage({
                    id: 'invite.members.user-is-not-guest',
                    defaultMessage: 'This person is already a member of the workspace. Invite them as a member instead of a guest.',
                }),
            },
        };
    }
    let memberOfAll = true;
    let memberOfAny = false;

    for (const channel of channels) {
        const member = members && members[channel.id] && members[channel.id][user.id];
        if (member) {
            memberOfAny = true;
        } else {
            memberOfAll = false;
        }
    }

    if (memberOfAll) {
        return {
            notSent: {
                user,
                reason: defineMessage({
                    id: 'invite.guests.already-all-channels-member',
                    defaultMessage: 'This person is already a member of all the channels.',
                }),
            },
        };
    }

    try {
        await dispatch(addUsersToTeam(teamId, [user.id]));
        for (const channel of channels) {
            const member = members && members[channel.id] && members[channel.id][user.id];
            if (!member) {
                await dispatch(joinChannel(user.id, teamId, channel.id, channel.name)); // eslint-disable-line no-await-in-loop
            }
        }
    } catch (e) {
        return {
            notSent: {
                user,
                reason: defineMessage({
                    id: 'invite.guests.unable-to-add-the-user-to-the-channels',
                    defaultMessage: 'Unable to add the guest to the channels.',
                }),
            },
        };
    }

    if (memberOfAny) {
        return {
            notSent: {
                user,
                reason: defineMessage({
                    id: 'invite.guests.already-some-channels-member',
                    defaultMessage: 'This person is already a member of some of the channels.',
                }),
            },
        };
    }
    return {
        sent: {
            user,
            reason: defineMessage({
                id: 'invite.guests.new-member',
                defaultMessage: 'This guest has been added to the team and {count, plural, one {channel} other {channels}}.',
                values: {
                    count: channels.length,
                },
            }),
        },
    };
}

export function sendGuestsInvites(
    teamId: string,
    channels: Channel[],
    users: UserProfile[],
    emails: string[],
    message: string,
): ActionFuncAsync<InviteResults> {
    return async (dispatch, getState) => {
        const state = getState();
        const sent = [];
        const notSent = [];
        const members = getChannelMembersInChannels(state);
        const results = await Promise.all(users.map((user) => sendGuestInviteForUser(dispatch, user, teamId, channels, members)));

        for (const result of results) {
            if ('sent' in result && result.sent) {
                sent.push(result.sent);
            }
            if ('notSent' in result && result.notSent) {
                notSent.push(result.notSent);
            }
        }

        if (emails.length > 0) {
            let response;
            try {
                response = await dispatch(TeamActions.sendEmailGuestInvitesToChannelsGracefully(teamId, channels.map((x) => x.id), emails, message));
            } catch (e) {
                response = {
                    data: emails.map((email) => ({
                        email,
                        error: {
                            error: defineMessage({
                                id: 'invite.guests.unable-to-add-the-user-to-the-channels',
                                defaultMessage: 'Unable to add the guest to the channels.',
                            }),
                        },
                    })) as unknown as TeamInviteWithError[],
                };
            }

            if (response.error) {
                if (response.error.server_error_id === 'app.email.rate_limit_exceeded.app_error') {
                    response.error.message = defineMessage({
                        id: 'invite.rate-limit-exceeded',
                        defaultMessage: 'Invite emails rate limit exceeded.',
                    });
                }
                for (const email of emails) {
                    notSent.push({
                        email,
                        reason: response.error.message,
                    });
                }
            } else {
                for (const res of (response.data || [])) {
                    if (res.error) {
                        if (res.error.id === 'api.team.invite_members.unable_to_send_email_with_defaults.app_error' && isCurrentUserSystemAdmin(state)) {
                            notSent.push({
                                email: res.email,
                                reason: defineMessage({
                                    id: 'admin.environment.smtp.smtpFailure',
                                    defaultMessage: 'SMTP is not configured in System Console. Can be configured <a>here</a>.',
                                }),
                                path: ConsolePages.SMTP,
                            });
                        } else {
                            notSent.push({
                                email: res.email,
                                reason: res.error.message,
                            });
                        }
                    } else {
                        sent.push({
                            email: res.email,
                            reason: defineMessage({
                                id: 'invite.guests.added-to-channel',
                                defaultMessage: 'An invitation email has been sent.',
                            }),
                        });
                    }
                }
            }
        }
        return {
            data: {
                sent,
                notSent,
            },
        };
    };
}

export function sendMembersInvitesToChannels(
    teamId: string,
    channels: Channel[],
    users: UserProfile[],
    emails: string[],
    message: string,
): ActionFuncAsync<InviteResults> {
    return async (dispatch, getState) => {
        if (users.length > 0) {
            // used to preload in the global store the teammembers info, used later to validate
            // if one of the invites is already part of the team by getTeamMembers > getMembersInTeam.
            await dispatch(TeamActions.getTeamMembersByIds(teamId, users.map((u) => u.id)));
        }
        const state = getState();
        const sent = [];
        const notSent = [];
        const usersToAdd = [];
        for (const user of users) {
            const member = getTeamMember(state, teamId, user.id);
            if (isGuest(user.roles)) {
                notSent.push({
                    user,
                    reason: defineMessage({
                        id: 'invite.members.user-is-guest',
                        defaultMessage: 'Contact your admin to make this guest a full member.',
                    }),
                });
            } else if (member) {
                notSent.push({
                    user,
                    reason: defineMessage({
                        id: 'invite.members.already-member',
                        defaultMessage: 'This person is already a team member.',
                    }),
                });
            } else {
                usersToAdd.push(user);
            }
        }
        if (usersToAdd.length > 0) {
            const response = await dispatch(addUsersToTeam(teamId, usersToAdd.map((u) => u.id)));
            const members = response.data || [];
            if (response.error) {
                for (const userToAdd of usersToAdd) {
                    notSent.push({
                        user: userToAdd,
                        reason: response.error.message,
                    });
                }
            } else {
                for (const userToAdd of usersToAdd) {
                    const memberWithError = members.find((m: TeamMemberWithError) => m.user_id === userToAdd.id && m.error);
                    if (memberWithError) {
                        notSent.push({
                            user: userToAdd,
                            reason: memberWithError.error.message,
                        });
                    } else {
                        sent.push({
                            user: userToAdd,
                            reason: defineMessage({
                                id: 'invite.members.added-to-team',
                                defaultMessage: 'This member has been added to the team.',
                            }),
                        });
                    }
                }
            }
        }
        if (emails.length > 0) {
            let response;
            try {
                response = await dispatch(
                    TeamActions.sendEmailInvitesToTeamAndChannelsGracefully(
                        teamId,
                        channels.map((x) => x.id),
                        emails,
                        message,
                    ),
                );
            } catch (e) {
                response = {
                    data: emails.map((email) => ({
                        email,
                        error: {
                            error: defineMessage({
                                id: 'invite.members.unable-to-add-the-user-to-the-team',
                                defaultMessage: 'Unable to add the user to the team.',
                            }),
                        },
                    })) as unknown as TeamInviteWithError[],
                };
            }
            const invitesWithErrors = response.data || [];
            if (response.error) {
                if (response.error.server_error_id === 'app.email.rate_limit_exceeded.app_error') {
                    response.error.message = defineMessage({id: 'invite.rate-limit-exceeded', defaultMessage: 'Invite emails rate limit exceeded.'});
                }
                for (const email of emails) {
                    notSent.push({
                        email,
                        reason: response.error.message,
                    });
                }
            } else {
                for (const email of emails) {
                    const inviteWithError = invitesWithErrors.find((i: TeamInviteWithError) => email.toLowerCase() === i.email && i.error);
                    if (inviteWithError) {
                        if (inviteWithError.error.id === 'api.team.invite_members.unable_to_send_email_with_defaults.app_error' && isCurrentUserSystemAdmin(state)) {
                            notSent.push({
                                email,
                                reason: defineMessage({
                                    id: 'admin.environment.smtp.smtpFailure',
                                    defaultMessage: 'SMTP is not configured in System Console. Can be configured <a>here</a>.',
                                }),
                                path: ConsolePages.SMTP,
                            });
                        } else {
                            notSent.push({
                                email,
                                reason: inviteWithError.error.message,
                            });
                        }
                    } else {
                        sent.push({
                            email,
                            reason: defineMessage({
                                id: 'invite.members.invite-sent',
                                defaultMessage: 'An invitation email has been sent.',
                            }),
                        });
                    }
                }
            }
        }
        return {
            data: {
                sent,
                notSent,
            },
        };
    };
}
