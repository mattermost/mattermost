// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {sendMembersInvites, sendGuestsInvites} from 'actions/invite_actions';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import {ConsolePages} from '../utils/constants';
import mockStore from 'tests/test_store';

jest.mock('actions/team_actions', () => ({
    addUsersToTeam: () => ({ // since we are using addUsersToTeamGracefully, this call will always succeed
        type: 'MOCK_RECEIVED_ME',
    }),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    joinChannel: (_userId: string, _teamId: string, channelId: string, _channelName: string) => {
        if (channelId === 'correct') {
            return ({type: 'MOCK_RECEIVED_ME'});
        }
        if (channelId === 'correct2') {
            return ({type: 'MOCK_RECEIVED_ME'});
        }
        throw new Error('ERROR');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getChannelMembersByIds: (channelId: string, userIds: string[]) => {
        return ({type: 'MOCK_RECEIVED_CHANNEL_MEMBERS'});
    },
}));

jest.mock('mattermost-redux/actions/teams', () => ({
    getTeamMembersByIds: () => ({type: 'MOCK_RECEIVED_ME'}),
    sendEmailInvitesToTeamGracefully: (team: string, emails: string[]) => {
        if (team === 'incorrect-default-smtp') {
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'SMTP is not configured in System Console.', id: 'api.team.invite_members.unable_to_send_email_with_defaults.app_error'}}))});
        } else if (emails.length > 21) { // Poor attempt to mock rate limiting.
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'Invite emails rate limit exceeded.'}}))});
        } else if (team === 'error') {
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'Unable to add the user to the team.'}}))});
        }

        // team === 'correct' i.e no error
        return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: undefined}))});
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sendEmailGuestInvitesToChannelsGracefully: (teamId: string, _channelIds: string[], emails: string[], _message: string) => {
        if (teamId === 'incorrect-default-smtp') {
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'SMTP is not configured in System Console.', id: 'api.team.invite_members.unable_to_send_email_with_defaults.app_error'}}))});
        } else if (emails.length > 21) { // Poor attempt to mock rate limiting.
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'Invite emails rate limit exceeded.'}}))});
        } else if (teamId === 'error') {
            return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: {message: 'Unable to add the guest to the channels.'}}))});
        }

        // teamId === 'correct' i.e no error
        return ({type: 'MOCK_RECEIVED_ME', data: emails.map((email) => ({email, error: undefined}))});
    },
}));

describe('actions/invite_actions', () => {
    const store = mockStore({
        entities: {
            general: {
                config: {
                    DefaultClientLocale: 'en',
                },
            },
            teams: {
                teams: {
                    correct: {id: 'correct'},
                    error: {id: 'error'},
                },
                membersInTeam: {
                    correct: {
                        user1: {id: 'user1'},
                        user2: {id: 'user2'},
                        guest1: {id: 'guest1'},
                        guest2: {id: 'guest2'},
                        guest3: {id: 'guest3'},
                    },
                    error: {
                        user1: {id: 'user1'},
                        user2: {id: 'user2'},
                        guest1: {id: 'guest1'},
                        guest2: {id: 'guest2'},
                        guest3: {id: 'guest3'},
                    },
                },
                myMembers: {},
            },
            channels: {
                myMembers: {},
                channels: {},
                membersInChannel: {
                    correct: {
                        guest2: {id: 'guest2'},
                        guest3: {id: 'guest3'},
                    },
                    correct2: {
                        guest2: {id: 'guest2'},
                    },
                    error: {
                        guest2: {id: 'guest2'},
                        guest3: {id: 'guest3'},
                    },
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        roles: 'system_admin',
                    },
                },
            },
        },
    });

    describe('sendMembersInvites', () => {
        it('should generate and empty list if nothing is passed', async () => {
            const response = await sendMembersInvites('correct', [], [])(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [],
                },
            });
        });

        it('should generate list of success for emails', async () => {
            const emails = ['email-one@email-one.com', 'email-two@email-two.com', 'email-three@email-three.com'];
            const response = await sendMembersInvites('correct', [], emails)(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: [],
                    sent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: 'An invitation email has been sent.',
                        },
                        {
                            email: 'email-two@email-two.com',
                            reason: 'An invitation email has been sent.',
                        },
                        {
                            email: 'email-three@email-three.com',
                            reason: 'An invitation email has been sent.',
                        },
                    ],
                },
            });
        });

        it('should generate list of failures for emails on invite fails', async () => {
            const emails = ['email-one@email-one.com', 'email-two@email-two.com', 'email-three@email-three.com'];
            const response = await sendMembersInvites('error', [], emails)(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: 'Unable to add the user to the team.',
                        },
                        {
                            email: 'email-two@email-two.com',
                            reason: 'Unable to add the user to the team.',
                        },
                        {
                            email: 'email-three@email-three.com',
                            reason: 'Unable to add the user to the team.',
                        },
                    ],
                },
            });
        });

        it('should generate list of failures and success for regular users and guests', async () => {
            const users = [
                {id: 'user1', roles: 'system_user'},
                {id: 'guest1', roles: 'system_guest'},
                {id: 'other-user', roles: 'system_user'},
                {id: 'other-guest', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendMembersInvites('correct', users, [])(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [
                        {
                            reason: 'This member has been added to the team.',
                            user: {
                                id: 'other-user',
                                roles: 'system_user',
                            },
                        },
                    ],
                    notSent: [
                        {
                            reason: 'This person is already a team member.',
                            user: {
                                id: 'user1',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'Contact your admin to make this guest a full member.',
                            user: {
                                id: 'guest1',
                                roles: 'system_guest',
                            },
                        },
                        {
                            reason: 'Contact your admin to make this guest a full member.',
                            user: {
                                id: 'other-guest',
                                roles: 'system_guest',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for problems adding a user', async () => {
            const users = [
                {id: 'user1', roles: 'system_user'},
                {id: 'guest1', roles: 'system_guest'},
                {id: 'other-user', roles: 'system_user'},
                {id: 'other-guest', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendMembersInvites('error', users, [])(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [{user: {id: 'other-user', roles: 'system_user'}, reason: 'This member has been added to the team.'}],
                    notSent: [
                        {
                            reason: 'This person is already a team member.',
                            user: {
                                id: 'user1',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'Contact your admin to make this guest a full member.',
                            user: {
                                id: 'guest1',
                                roles: 'system_guest',
                            },
                        },
                        {
                            reason: 'Contact your admin to make this guest a full member.',
                            user: {
                                id: 'other-guest',
                                roles: 'system_guest',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for rate limits', async () => {
            const emails = [];
            const expectedNotSent = [];
            for (let i = 0; i < 22; i++) {
                emails.push('email-' + i + '@example.com');
                expectedNotSent.push({
                    email: 'email-' + i + '@example.com',
                    reason: 'Invite emails rate limit exceeded.',
                });
            }
            const response = await sendMembersInvites('correct', [], emails)(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: expectedNotSent,
                    sent: [],
                },
            });
        });

        it('should generate a failure for smtp config', async () => {
            const emails = ['email-one@email-one.com'];
            const response = await sendMembersInvites('incorrect-default-smtp', [], emails)(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: {
                                id: 'admin.environment.smtp.smtpFailure',
                                message: 'SMTP is not configured in System Console. Can be configured <a>here</a>.',
                            },
                            path: ConsolePages.SMTP,
                        }],
                    sent: [],
                },
            });
        });
    });

    describe('sendGuestsInvites', () => {
        it('should generate and empty list if nothing is passed', async () => {
            const response = await sendGuestsInvites('correct', [], [], [], '')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [],
                },
            });
        });

        it('should generate list of success for emails', async () => {
            const channels = [{id: 'correct'}] as Channel[];
            const emails = ['email-one@email-one.com', 'email-two@email-two.com', 'email-three@email-three.com'];
            const response = await sendGuestsInvites('correct', channels, [], emails, 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: [],
                    sent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: 'An invitation email has been sent.',
                        },
                        {
                            email: 'email-two@email-two.com',
                            reason: 'An invitation email has been sent.',
                        },
                        {
                            email: 'email-three@email-three.com',
                            reason: 'An invitation email has been sent.',
                        },
                    ],
                },
            });
        });

        it('should generate list of failures for emails on invite fails', async () => {
            const channels = [{id: 'correct'}] as Channel[];
            const emails = ['email-one@email-one.com', 'email-two@email-two.com', 'email-three@email-three.com'];
            const response = await sendGuestsInvites('error', channels, [], emails, 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: 'Unable to add the guest to the channels.',
                        },
                        {
                            email: 'email-two@email-two.com',
                            reason: 'Unable to add the guest to the channels.',
                        },
                        {
                            email: 'email-three@email-three.com',
                            reason: 'Unable to add the guest to the channels.',
                        },
                    ],
                },
            });
        });

        it('should generate list of failures and success for regular users and guests', async () => {
            const channels = [{id: 'correct'}] as Channel[];
            const users = [
                {id: 'user1', roles: 'system_user'},
                {id: 'guest1', roles: 'system_guest'},
                {id: 'other-user', roles: 'system_user'},
                {id: 'other-guest', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendGuestsInvites('correct', channels, users, [], 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [
                        {
                            reason: {
                                id: 'invite.guests.new-member',
                                message: 'This guest has been added to the team and {count, plural, one {channel} other {channels}}.',
                                values: {count: channels.length},
                            },
                            user: {
                                id: 'guest1',
                                roles: 'system_guest',
                            },
                        },
                        {
                            reason: {
                                id: 'invite.guests.new-member',
                                message: 'This guest has been added to the team and {count, plural, one {channel} other {channels}}.',
                                values: {count: channels.length},
                            },
                            user: {
                                id: 'other-guest',
                                roles: 'system_guest',
                            },
                        },
                    ],
                    notSent: [
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'user1',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'other-user',
                                roles: 'system_user',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for users that are part of all or some of the channels', async () => {
            const users = [
                {id: 'guest2', roles: 'system_guest'},
                {id: 'guest3', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendGuestsInvites('correct', [{id: 'correct'}, {id: 'correct2'}] as Channel[], users, [], 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [
                        {
                            reason: 'This person is already a member of all the channels.',
                            user: {
                                id: 'guest2',
                                roles: 'system_guest',
                            },
                        },
                        {
                            reason: 'This person is already a member of some of the channels.',
                            user: {
                                id: 'guest3',
                                roles: 'system_guest',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for problems adding a user to team', async () => {
            const users = [
                {id: 'user1', roles: 'system_user'},
                {id: 'guest1', roles: 'system_guest'},
                {id: 'other-user', roles: 'system_user'},
                {id: 'other-guest', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendGuestsInvites('error', [{id: 'correct'}] as Channel[], users, [], 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);

            expect(response).toEqual({
                data: {
                    sent: [
                        {
                            user: {
                                id: 'guest1',
                                roles: 'system_guest',
                            },
                            reason: {
                                id: 'invite.guests.new-member',
                                message: 'This guest has been added to the team and {count, plural, one {channel} other {channels}}.',
                                values: {
                                    count: 1,
                                },
                            },
                        },
                        {
                            user: {
                                id: 'other-guest',
                                roles: 'system_guest',
                            },
                            reason: {
                                id: 'invite.guests.new-member',
                                message: 'This guest has been added to the team and {count, plural, one {channel} other {channels}}.',
                                values: {
                                    count: 1,
                                },
                            },
                        },
                    ],
                    notSent: [
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'user1',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'other-user',
                                roles: 'system_user',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for problems adding a user to channels', async () => {
            const users = [
                {id: 'user1', roles: 'system_user'},
                {id: 'guest1', roles: 'system_guest'},
                {id: 'other-user', roles: 'system_user'},
                {id: 'other-guest', roles: 'system_guest'},
            ] as UserProfile[];
            const response = await sendGuestsInvites('correct', [{id: 'error'}] as Channel[], users, [], 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    sent: [],
                    notSent: [
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'user1',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'Unable to add the guest to the channels.',
                            user: {
                                id: 'guest1',
                                roles: 'system_guest',
                            },
                        },
                        {
                            reason: 'This person is already a member.',
                            user: {
                                id: 'other-user',
                                roles: 'system_user',
                            },
                        },
                        {
                            reason: 'Unable to add the guest to the channels.',
                            user: {
                                id: 'other-guest',
                                roles: 'system_guest',
                            },
                        },
                    ],
                },
            });
        });

        it('should generate a failure for rate limits', async () => {
            const emails = [];
            const expectedNotSent = [];
            for (let i = 0; i < 22; i++) {
                emails.push('email-' + i + '@example.com');
                expectedNotSent.push({
                    email: 'email-' + i + '@example.com',
                    reason: 'Invite emails rate limit exceeded.',
                });
            }

            const response = await sendGuestsInvites('correct', [{id: 'correct'}] as Channel[], [], emails, 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: expectedNotSent,
                    sent: [],
                },
            });
        });

        it('should generate a failure for smtp config', async () => {
            const emails = ['email-one@email-one.com'];
            const response = await sendGuestsInvites('incorrect-default-smtp', [{id: 'error'}] as Channel[], [], emails, 'message')(store.dispatch as DispatchFunc, store.getState as GetStateFunc);
            expect(response).toEqual({
                data: {
                    notSent: [
                        {
                            email: 'email-one@email-one.com',
                            reason: {
                                id: 'admin.environment.smtp.smtpFailure',
                                message: 'SMTP is not configured in System Console. Can be configured <a>here</a>.',
                            },
                            path: ConsolePages.SMTP,
                        }],
                    sent: [],
                },
            });
        });
    });
});
