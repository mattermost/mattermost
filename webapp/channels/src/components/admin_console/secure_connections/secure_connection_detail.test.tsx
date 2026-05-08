// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';
import {Route} from 'react-router-dom';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnectionDetail from './secure_connection_detail';

jest.mock('./chat.svg', () => () => <svg data-testid='chat-svg'/>);

jest.mock('./modals/modal_utils', () => ({
    useRemoteClusterCreate: () => ({promptCreate: jest.fn().mockResolvedValue(undefined), saving: false}),
    useSharedChannelsAdd: () => ({promptAdd: jest.fn().mockResolvedValue(undefined)}),
    useSharedChannelsRemove: () => ({promptRemove: jest.fn().mockResolvedValue(undefined)}),
}));

const team = TestHelper.getTeamMock({id: 'team-1', display_name: 'Team One'});
const teamMembership = TestHelper.getTeamMembershipMock({team_id: 'team-1', delete_at: 0});

const baseState = {
    entities: {
        teams: {
            currentTeamId: 'team-1',
            teams: {'team-1': team},
            myMembers: {'team-1': teamMembership},
        },
        channels: {
            channels: {},
            channelsInTeam: {},
        },
    },
};

const remoteCluster: RemoteCluster = {
    remote_id: 'rc-1',
    display_name: 'Acme',
    name: 'acme',
    site_url: 'https://acme.example.com',
    last_ping_at: Date.now() - 5_000,
    default_team_id: 'team-1',
} as RemoteCluster;

function renderAtPath(path: string, state: any = baseState) {
    return renderWithContext(
        <Route path='/admin_console/site_config/secure_connections/:connection_id'>
            <SecureConnectionDetail disabled={false}/>
        </Route>,
        state,
        {history: require('history').createMemoryHistory({initialEntries: [path]})},
    );
}

describe('SecureConnectionDetail', () => {
    let getRemoteCluster: jest.SpyInstance;
    let getSharedChannelRemotes: jest.SpyInstance;

    beforeEach(() => {
        getRemoteCluster = jest.spyOn(Client4, 'getRemoteCluster').mockResolvedValue(remoteCluster);
        getSharedChannelRemotes = jest.spyOn(Client4, 'getSharedChannelRemotes').mockResolvedValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the page title and back link', async () => {
        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        expect(screen.getByText('Connection Configuration')).toBeInTheDocument();
        expect(screen.getByText('Connection Details')).toBeInTheDocument();
    });

    it('shows a loading state while the cluster is being fetched', () => {
        getRemoteCluster.mockImplementation(() => new Promise<never>(() => {}));

        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        expect(screen.getAllByText('Loading').length).toBeGreaterThan(0);
    });

    it('renders the org name input pre-filled when editing', async () => {
        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        await waitFor(() => {
            expect(screen.getByTestId('organization-name-input')).toHaveValue('Acme');
        });
        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('renders an empty org name input in create mode', () => {
        renderAtPath('/admin_console/site_config/secure_connections/create');

        expect(screen.getByTestId('organization-name-input')).toHaveValue('');
    });

    it('hides the shared channels section in create mode', () => {
        renderAtPath('/admin_console/site_config/secure_connections/create');

        expect(screen.queryByText('Shared Channels')).not.toBeInTheDocument();
    });

    it('shows the shared channels section in edit mode', async () => {
        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        await waitFor(() => {
            expect(screen.getByText('Shared Channels')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', {name: /Add channels/})).toBeInTheDocument();
    });

    it('typing in the org name input enables the save panel', async () => {
        const user = userEvent.setup();
        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        await waitFor(() => {
            expect(screen.getByTestId('organization-name-input')).toHaveValue('Acme');
        });

        const saveButton = screen.getByRole('button', {name: 'Save'});
        expect(saveButton).toBeDisabled();

        const input = screen.getByTestId('organization-name-input');
        await user.clear(input);
        await user.type(input, 'Acme Renamed');

        expect(screen.getByTestId('organization-name-input')).toHaveValue('Acme Renamed');

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
        });
    });

    it('renders the placeholder when no shared channels exist (edit mode, confirmed)', async () => {
        renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        await waitFor(() => {
            expect(screen.getByTestId('chat-svg')).toBeInTheDocument();
        });
        expect(getSharedChannelRemotes).toHaveBeenCalled();
    });
});
