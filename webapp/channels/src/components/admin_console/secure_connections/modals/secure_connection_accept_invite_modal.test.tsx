// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import {ClientError} from '@mattermost/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnectionAcceptInviteModal from './secure_connection_accept_invite_modal';

jest.mock('../team_selector', () => {
    return function MockTeamSelector(props: {testId: string; onChange: (id: string) => void}) {
        return (
            <button
                type='button'
                data-testid={props.testId}
                onClick={() => props.onChange('team-1')}
            >
                {'select team'}
            </button>
        );
    };
});

const remoteCluster = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    display_name: 'Acme',
});

const baseState = {
    entities: {
        teams: {
            currentTeamId: 'team-1',
            teams: {
                'team-1': TestHelper.getTeamMock({id: 'team-1', display_name: 'Team One'}),
            },
            myMembers: {
                'team-1': TestHelper.getTeamMembershipMock({team_id: 'team-1', delete_at: 0}),
            },
        },
    },
};

describe('SecureConnectionAcceptInviteModal', () => {
    it('renders the title and the four input fields', () => {
        renderWithContext(
            <SecureConnectionAcceptInviteModal
                onConfirm={jest.fn().mockResolvedValue(remoteCluster)}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
            />,
            baseState,
        );

        expect(screen.getByText('Accept a connection invite')).toBeInTheDocument();
        expect(screen.getByTestId('display-name')).toBeInTheDocument();
        expect(screen.getByTestId('destination-team-input')).toBeInTheDocument();
        expect(screen.getByTestId('invite-code')).toBeInTheDocument();
        expect(screen.getByTestId('password')).toBeInTheDocument();
    });

    it('keeps the Accept button disabled when any single field is missing', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionAcceptInviteModal
                onConfirm={jest.fn().mockResolvedValue(remoteCluster)}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
            />,
            baseState,
        );

        // Fill three of four — omit the password.
        await user.type(screen.getByTestId('display-name'), 'Acme Org');
        await user.type(screen.getByTestId('invite-code'), 'INVITE');
        await user.click(screen.getByTestId('destination-team-input'));

        expect(screen.getByRole('button', {name: 'Accept'})).toBeDisabled();
    });

    it('disables the Accept button until all four fields are filled', async () => {
        const user = userEvent.setup();

        renderWithContext(
            <SecureConnectionAcceptInviteModal
                onConfirm={jest.fn().mockResolvedValue(remoteCluster)}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
            />,
            baseState,
        );

        const accept = screen.getByRole('button', {name: 'Accept'});
        expect(accept).toBeDisabled();

        await user.type(screen.getByTestId('display-name'), 'Acme Org');
        await user.type(screen.getByTestId('invite-code'), 'INVITE');
        await user.type(screen.getByTestId('password'), 'PASSWORD');
        await user.click(screen.getByTestId('destination-team-input'));

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Accept'})).toBeEnabled();
        });
    });

    it('calls onConfirm with the form values when Accept is clicked', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockResolvedValue(remoteCluster);
        const onHide = jest.fn();

        renderWithContext(
            <SecureConnectionAcceptInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={onHide}
            />,
            baseState,
        );

        await user.type(screen.getByTestId('display-name'), 'Acme Org');
        await user.type(screen.getByTestId('invite-code'), 'INVITE');
        await user.type(screen.getByTestId('password'), 'PASSWORD');
        await user.click(screen.getByTestId('destination-team-input'));

        await user.click(screen.getByRole('button', {name: 'Accept'}));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith({
                display_name: 'Acme Org',
                default_team_id: 'team-1',
                invite: 'INVITE',
                password: 'PASSWORD',
            });
        });
        await waitFor(() => {
            expect(onHide).toHaveBeenCalledTimes(1);
        });
    });

    it('shows the error message when onConfirm rejects', async () => {
        const user = userEvent.setup();
        const onConfirm = jest.fn().mockRejectedValue(new ClientError('http://localhost', {url: '/x', message: 'denied'}));

        renderWithContext(
            <SecureConnectionAcceptInviteModal
                onConfirm={onConfirm}
                onCancel={jest.fn()}
                onExited={jest.fn()}
                onHide={jest.fn()}
            />,
            baseState,
        );

        await user.type(screen.getByTestId('display-name'), 'Acme Org');
        await user.type(screen.getByTestId('invite-code'), 'INVITE');
        await user.type(screen.getByTestId('password'), 'PASSWORD');
        await user.click(screen.getByTestId('destination-team-input'));

        await user.click(screen.getByRole('button', {name: 'Accept'}));

        await waitFor(() => {
            expect(screen.getByText('There was an error while accepting the invite.')).toBeInTheDocument();
        });
    });
});
