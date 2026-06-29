// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import React from 'react';
import {Route} from 'react-router-dom';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SecureConnectionDetail from './secure_connection_detail';

const mockPromptCreate = jest.fn();
const mockHistoryReplace = jest.fn();

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useHistory: () => ({replace: mockHistoryReplace, push: jest.fn()}),
}));

jest.mock('./chat.svg', () => () => <svg data-testid='chat-svg'/>);

jest.mock('./team_selector', () => {
    return function MockTeamSelector(props: {testId: string; onChange: (teamId: string) => void}) {
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

jest.mock('./modals/modal_utils', () => ({
    useRemoteClusterCreate: () => ({promptCreate: mockPromptCreate, saving: false}),
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

const remoteCluster = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    display_name: 'Acme',
    name: 'acme',
    site_url: 'https://acme.example.com',
    last_ping_at: Date.now() - 5_000,
    default_team_id: 'team-1',
});

function renderAtPath(path: string, state: any = baseState) {
    return renderWithContext(
        <Route path='/admin_console/site_config/secure_connections/:connection_id'>
            <SecureConnectionDetail disabled={false}/>
        </Route>,
        state,
        {history: createMemoryHistory({initialEntries: [path]})},
    );
}

describe('SecureConnectionDetail', () => {
    let getRemoteCluster: jest.SpyInstance;
    let getSharedChannelRemotes: jest.SpyInstance;

    beforeEach(() => {
        getRemoteCluster = jest.spyOn(Client4, 'getRemoteCluster').mockResolvedValue(remoteCluster);
        getSharedChannelRemotes = jest.spyOn(Client4, 'getSharedChannelRemotes').mockResolvedValue([]);
        mockPromptCreate.mockReset();
        mockPromptCreate.mockResolvedValue(undefined);
        mockHistoryReplace.mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the page title and back link', async () => {
        const {container} = renderAtPath('/admin_console/site_config/secure_connections/rc-1');

        expect(screen.getByText('Connection Configuration')).toBeInTheDocument();
        expect(screen.getByText('Connection Details')).toBeInTheDocument();

        const backLink = container.querySelector('a[href="/admin_console/site_config/secure_connections"].back');
        expect(backLink).toBeInTheDocument();
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

    it('navigates to the new connection edit page after a successful create', async () => {
        const user = userEvent.setup();
        const created = TestHelper.getRemoteClusterMock({remote_id: 'rc-new', display_name: 'New Org', default_team_id: 'team-1'});
        mockPromptCreate.mockResolvedValueOnce(created);

        renderAtPath('/admin_console/site_config/secure_connections/create');

        await user.type(screen.getByTestId('organization-name-input'), 'New Org');
        await user.click(screen.getByTestId('destination-team-input'));

        await waitFor(() => {
            expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
        });
        await user.click(screen.getByRole('button', {name: 'Save'}));

        await waitFor(() => {
            expect(mockPromptCreate).toHaveBeenCalledWith({display_name: 'New Org', default_team_id: 'team-1'});
        });
        await waitFor(() => {
            expect(mockHistoryReplace).toHaveBeenCalledWith(expect.objectContaining({
                pathname: '/admin_console/site_config/secure_connections/rc-new',
            }));
        });
    });
});
