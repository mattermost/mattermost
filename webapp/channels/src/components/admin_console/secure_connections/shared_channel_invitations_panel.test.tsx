// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel, ServerChannel} from '@mattermost/types/channels';
import type {SharedChannelInvitation} from '@mattermost/types/shared_channels';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import SharedChannelInvitationsPanel from './shared_channel_invitations_panel';

jest.mock('mattermost-redux/client', () => {
    const actual = jest.requireActual<typeof import('mattermost-redux/client')>('mattermost-redux/client');
    return {
        ...actual,
        Client4: Object.assign(actual.Client4, {
            getSharedChannelInvitationsByRemote: jest.fn(),
            getChannel: jest.fn(),
        }),
    };
});

const getInvitations = Client4.getSharedChannelInvitationsByRemote as jest.MockedFunction<
    typeof Client4.getSharedChannelInvitationsByRemote
>;
const getChannelApi = Client4.getChannel as jest.MockedFunction<typeof Client4.getChannel>;

function asServerChannel(channel: Channel): ServerChannel {
    return {
        ...channel,
        total_msg_count: 0,
        total_msg_count_root: 0,
    };
}

function makeTestChannel(overrides: Partial<Channel> = {}): Channel {
    const now = Date.now();
    return {
        id: 'channel-in-store',
        create_at: now,
        update_at: now,
        delete_at: 0,
        team_id: 'team-1',
        type: 'O',
        display_name: 'Channel In Store',
        name: 'channel-in-store',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: 'user-1',
        scheme_id: '',
        group_constrained: false,
        ...overrides,
    };
}

function makeInvitation(overrides: Partial<SharedChannelInvitation> = {}): SharedChannelInvitation {
    return {
        id: 'inv-1',
        channel_id: 'channel-in-store',
        remote_id: 'remote-1',
        direction: 'sent',
        status: 'pending',
        creator_id: 'user-1',
        create_at: 1_700_000_000_000,
        update_at: 1_700_000_000_000,
        ...overrides,
    };
}

const remoteId = 'remote-abc';

const minimalState = {
    entities: {
        users: {
            currentUserId: 'user-1',
        },
        general: {
            config: {},
            license: {},
        },
        teams: {
            currentTeamId: 'team-1',
            teams: {
                'team-1': {
                    id: 'team-1',
                    name: 'team',
                    display_name: 'Team',
                },
            },
        },
        channels: {
            channels: {
                'channel-in-store': makeTestChannel(),
            },
        },
    },
};

describe('SharedChannelInvitationsPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getChannelApi.mockResolvedValue(asServerChannel(makeTestChannel({id: 'channel-not-in-store'})));
    });

    test('shows loading until the API resolves', async () => {
        let resolveList!: (value: SharedChannelInvitation[]) => void;
        getInvitations.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveList = resolve;
                }),
        );

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        expect(screen.getByText('Loading')).toBeInTheDocument();

        resolveList([]);
        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });
    });

    test('shows an error message when loading fails', async () => {
        getInvitations.mockRejectedValue(new Error('network'));

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(screen.getByText('Unable to load invitations. Try again later.')).toBeInTheDocument();
        });
    });

    test('shows empty hint when there are no invitations', async () => {
        getInvitations.mockResolvedValue([]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(
                screen.getByText(
                    'There are no stored invitation records for this connection. Pending rows clear after success; failed or rejected invitations appear here.',
                ),
            ).toBeInTheDocument();
        });
    });

    test('header shows failed and pending counts after load', async () => {
        getInvitations.mockResolvedValue([
            makeInvitation({id: 'inv-f', status: 'failed'}),
            makeInvitation({id: 'inv-p1', status: 'pending'}),
            makeInvitation({id: 'inv-p2', status: 'pending'}),
        ]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(screen.getByText('1 failed')).toBeInTheDocument();
            expect(screen.getByText('2 pending')).toBeInTheDocument();
        });
    });

    test('collapsing hides invitation panel content', async () => {
        getInvitations.mockResolvedValue([]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(
                screen.getByText(
                    'There are no stored invitation records for this connection. Pending rows clear after success; failed or rejected invitations appear here.',
                ),
            ).toBeInTheDocument();
        });

        await userEvent.click(
            screen.getByRole('button', {name: 'Show or hide invitation activity'}),
        );

        expect(
            screen.queryByText(
                'There are no stored invitation records for this connection. Pending rows clear after success; failed or rejected invitations appear here.',
            ),
        ).not.toBeInTheDocument();
    });

    test('refetches when refresh changes', async () => {
        getInvitations.mockResolvedValue([]);

        const {rerender} = renderWithContext(
            <SharedChannelInvitationsPanel
                remoteId={remoteId}
                refresh={0}
            />,
            minimalState,
        );

        await waitFor(() => expect(getInvitations).toHaveBeenCalledTimes(1));

        rerender(
            <SharedChannelInvitationsPanel
                remoteId={remoteId}
                refresh={1}
            />,
        );

        await waitFor(() => expect(getInvitations).toHaveBeenCalledTimes(2));
        expect(getInvitations).toHaveBeenLastCalledWith(remoteId, 0, 500);
    });

    test('ignores stale list response after remoteId changes', async () => {
        let resolveFirst!: (value: SharedChannelInvitation[]) => void;
        let resolveSecond!: (value: SharedChannelInvitation[]) => void;
        let invocation = 0;
        getInvitations.mockImplementation(() => {
            invocation++;
            if (invocation === 1) {
                return new Promise<SharedChannelInvitation[]>((resolve) => {
                    resolveFirst = resolve;
                });
            }
            return new Promise<SharedChannelInvitation[]>((resolve) => {
                resolveSecond = resolve;
            });
        });

        const {rerender} = renderWithContext(
            <SharedChannelInvitationsPanel remoteId='remote-first'/>,
            minimalState,
        );

        await waitFor(() => expect(invocation).toBe(1));

        rerender(<SharedChannelInvitationsPanel remoteId='remote-second'/>);

        await waitFor(() => expect(invocation).toBe(2));

        resolveSecond([
            makeInvitation({id: 'inv-fresh', channel_id: 'channel-in-store'}),
        ]);

        await waitFor(() => {
            expect(screen.getByText('Channel In Store')).toBeInTheDocument();
        });

        resolveFirst([
            makeInvitation({
                id: 'inv-stale',
                channel_id: 'channel-missing-from-store',
            }),
        ]);

        await waitFor(() => {
            expect(screen.queryByText('channel-missing-from-store')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Channel In Store')).toBeInTheDocument();
    });

    test('renders table rows with direction, status, details, and recorded time', async () => {
        getInvitations.mockResolvedValue([
            makeInvitation({
                id: 'inv-a',
                direction: 'sent',
                status: 'pending',
                error: undefined,
            }),
            makeInvitation({
                id: 'inv-b',
                channel_id: 'channel-in-store',
                direction: 'received',
                status: 'failed',
                error: 'boom',
            }),
            makeInvitation({
                id: 'inv-c',
                channel_id: 'channel-in-store',
                direction: 'sent',
                status: 'rejected',
            }),
        ]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(screen.getByRole('columnheader', {name: 'Channel'})).toBeInTheDocument();
        });

        expect(screen.getAllByText('Channel In Store')).toHaveLength(3);
        expect(screen.getAllByText('Sent')).toHaveLength(2);
        expect(screen.getByText('Received')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Rejected')).toBeInTheDocument();
        expect(screen.getByText('boom')).toBeInTheDocument();
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    });

    test('shows channel id when the channel is not in the store', async () => {
        const missingId = 'channel-missing-from-store';
        getInvitations.mockResolvedValue([
            makeInvitation({
                id: 'inv-x',
                channel_id: missingId,
            }),
        ]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(screen.getByText(missingId)).toBeInTheDocument();
        });
    });

    test('shows unknown status label for unexpected status values', async () => {
        getInvitations.mockResolvedValue([
            makeInvitation({
                id: 'inv-z',
                status: 'weird' as unknown as SharedChannelInvitation['status'],
            }),
        ]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, minimalState);

        await waitFor(() => {
            expect(screen.getByText('Unknown status (weird)')).toBeInTheDocument();
        });
    });

    test('dispatches fetch for each unique channel id after rows load', async () => {
        getInvitations.mockResolvedValue([
            makeInvitation({id: 'inv-1', channel_id: 'channel-a'}),
            makeInvitation({id: 'inv-2', channel_id: 'channel-b'}),
            makeInvitation({id: 'inv-3', channel_id: 'channel-a'}),
        ]);

        renderWithContext(<SharedChannelInvitationsPanel remoteId={remoteId}/>, {
            ...minimalState,
            entities: {
                ...minimalState.entities,
                channels: {
                    channels: {},
                },
            },
        });

        await waitFor(() => {
            expect(getChannelApi).toHaveBeenCalledWith('channel-a', false);
            expect(getChannelApi).toHaveBeenCalledWith('channel-b', false);
        });
        expect(getChannelApi).toHaveBeenCalledTimes(2);
    });
});
