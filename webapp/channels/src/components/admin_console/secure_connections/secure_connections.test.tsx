// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnections from './secure_connections';

jest.mock('./building.svg', () => () => <svg data-testid='building-svg'/>);

jest.mock('./modals/modal_utils', () => ({
    useRemoteClusterAcceptInvite: () => ({promptAcceptInvite: jest.fn().mockResolvedValue(undefined)}),
    useRemoteClusterDelete: () => ({promptDelete: jest.fn().mockResolvedValue(undefined)}),
    useRemoteClusterCreateInvite: () => ({promptCreateInvite: jest.fn().mockResolvedValue(undefined)}),
}));

const sampleClusters: RemoteCluster[] = [
    TestHelper.getRemoteClusterMock({remote_id: 'rc-1', display_name: 'Acme', name: 'acme', site_url: 'https://acme', last_ping_at: 0}),
    TestHelper.getRemoteClusterMock({remote_id: 'rc-2', display_name: 'Beta', name: 'beta', site_url: 'https://beta', last_ping_at: 0}),
];

describe('SecureConnections', () => {
    let getRemoteClusters: jest.SpyInstance;

    beforeEach(() => {
        getRemoteClusters = jest.spyOn(Client4, 'getRemoteClusters');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('shows the LoadingScreen while remote clusters are loading', async () => {
        getRemoteClusters.mockImplementation(() => new Promise<never>(() => {}));

        renderWithContext(<SecureConnections/>);

        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    it('renders the placeholder when no remote clusters exist', async () => {
        getRemoteClusters.mockResolvedValue([]);

        renderWithContext(<SecureConnections/>);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: 'Share channels'})).toBeInTheDocument();
        });
        expect(screen.getByText('Connecting with an external workspace allows you to share channels with them')).toBeInTheDocument();
    });

    it('renders one row per remote cluster with their display names', async () => {
        getRemoteClusters.mockResolvedValue(sampleClusters);

        renderWithContext(<SecureConnections/>);

        await waitFor(() => {
            expect(screen.getByText('Acme')).toBeInTheDocument();
        });
        expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('shows the "service not running" notice when the API returns the service-not-enabled error', async () => {
        getRemoteClusters.mockRejectedValue(Object.assign(new Error('disabled'), {server_error_id: 'api.remote_cluster.service_not_enabled.app_error'}));

        renderWithContext(<SecureConnections/>);

        await waitFor(() => {
            expect(screen.getByText('Service not running, please restart server.')).toBeInTheDocument();
        });
    });

    it('renders the "Add a connection" button', async () => {
        getRemoteClusters.mockResolvedValue([]);

        renderWithContext(<SecureConnections/>);

        await waitFor(() => {
            expect(screen.getAllByText('Add a connection').length).toBeGreaterThan(0);
        });
    });
});
