// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {ClientError} from '@mattermost/client';
import type {DeepPartial} from '@mattermost/types/utilities';

import {getConfig as getAdminConfig, getEnvironmentConfig} from 'mattermost-redux/actions/admin';
import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import PreparingWorkspace from './preparing_workspace';

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin'),
    getEnvironmentConfig: jest.fn(),
    getConfig: jest.fn(),
}));

jest.mock('mattermost-redux/actions/general', () => ({
    ...jest.requireActual('mattermost-redux/actions/general'),
    getFirstAdminSetupComplete: jest.fn(() => () => Promise.resolve({data: false})),
}));

const siteUrlTitle = 'Confirm your server’s URL';
const inviteTitle = 'Invite your team members';

type ConfigResult = {data?: unknown; error?: unknown};

describe('components/preparing_workspace/preparing_workspace', () => {
    let completeSetup: jest.SpyInstance;
    let testSiteURL: jest.SpyInstance;

    const mockConfigs = (envConfig: ConfigResult | Promise<ConfigResult>, adminConfig: ConfigResult = {data: {ExperimentalSettings: {RestrictSystemAdmin: false}}}) => {
        (getEnvironmentConfig as jest.Mock).mockReturnValue(() => Promise.resolve(envConfig));
        (getAdminConfig as jest.Mock).mockReturnValue(() => Promise.resolve(adminConfig));
    };

    const makeState = (config: Record<string, string> = {}, cloud = false): DeepPartial<GlobalState> => ({
        entities: {
            general: {
                config: {
                    EnableOnboardingFlow: 'true',
                    PluginsEnabled: 'false',
                    SiteURL: '',
                    ...config,
                },
                license: {Cloud: cloud ? 'true' : 'false'},
                firstAdminCompleteSetup: false,
            },
            users: {
                currentUserId: 'admin',
                profiles: {
                    admin: {id: 'admin', roles: 'system_admin system_user', create_at: 1},
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {id: 'team1', name: 'team1', display_name: 'Team 1', invite_id: 'invite1', delete_at: 0},
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'admin', roles: 'team_user team_admin', delete_at: 0},
                },
            },
        },
    });

    const renderWizard = (state = makeState(), createTeam = jest.fn().mockResolvedValue({data: {id: 'team1', invite_id: 'invite1'}})) => {
        const history = createMemoryHistory();
        const actions = {
            createTeam,
            updateTeam: jest.fn().mockResolvedValue({data: {id: 'team1'}}),
            checkIfTeamExists: jest.fn().mockResolvedValue({data: false}),
            getProfiles: jest.fn().mockResolvedValue({data: []}),
        };
        return renderWithContext(
            <PreparingWorkspace
                actions={actions}
                history={history}
            />,
            state,
        );
    };

    // Waits until the wizard has decided whether to show the Site URL step.
    const waitForConfigs = async () => {
        await waitFor(() => expect(getAdminConfig).toHaveBeenCalled());
        await act(async () => {});
    };

    const completeOrganization = async () => {
        await userEvent.type(await screen.findByPlaceholderText('Organization name'), 'Acme');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        await waitFor(() => expect(screen.queryByPlaceholderText('Organization name')).not.toBeInTheDocument());
    };

    const finishSetup = async () => {
        await userEvent.click(await screen.findByRole('button', {name: 'Finish setup'}));
        await waitFor(() => expect(completeSetup).toHaveBeenCalledTimes(1));
    };

    beforeEach(() => {
        mockConfigs({data: {}});
        completeSetup = jest.spyOn(Client4, 'completeSetup').mockResolvedValue({status: 'OK'});
        testSiteURL = jest.spyOn(Client4, 'testSiteURL').mockResolvedValue({status: 'OK'});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (getEnvironmentConfig as jest.Mock).mockReset();
        (getAdminConfig as jest.Mock).mockReset();
    });

    test('shows the step after Organization, prefilled with the browser URL, and sends the entered URL', async () => {
        renderWizard();
        await waitForConfigs();
        await completeOrganization();

        expect(screen.getByText(siteUrlTitle)).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toHaveValue(window.location.origin);

        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.type(screen.getByRole('textbox'), 'https://chat.example.com/');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();
        expect(testSiteURL).toHaveBeenCalledWith('https://chat.example.com');
        expect(screen.getByTestId('shareLinkInput')).toHaveValue('https://chat.example.com/signup_user_complete/?id=invite1');

        await finishSetup();
        expect(completeSetup).toHaveBeenCalledWith({
            organization: 'Acme',
            install_plugins: [],
            site_url: 'https://chat.example.com',
        });
    });

    test('keeps the entered URL when the new team is created after the admin has left the Organization step', async () => {
        const state = makeState();
        state.entities!.teams = {currentTeamId: '', teams: {}, myMembers: {}};
        let resolveCreateTeam: (result: unknown) => void = () => {};
        const createTeam = jest.fn(() => new Promise((resolve) => {
            resolveCreateTeam = resolve;
        }));
        renderWizard(state, createTeam);
        await waitForConfigs();
        await completeOrganization();

        await userEvent.clear(screen.getByRole('textbox'));
        await userEvent.type(screen.getByRole('textbox'), 'https://chat.example.com');
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();

        await act(async () => resolveCreateTeam({data: {id: 'team1', invite_id: 'invite1'}}));

        expect(screen.getByTestId('shareLinkInput')).toHaveValue('https://chat.example.com/signup_user_complete/?id=invite1');
    });

    test('shows the step when the Site URL is the default localhost URL', async () => {
        renderWizard(makeState({SiteURL: 'http://localhost:8065'}));
        await waitForConfigs();
        await completeOrganization();

        expect(screen.getByText(siteUrlTitle)).toBeInTheDocument();
    });

    test('does not send the URL when the admin skips the step', async () => {
        renderWizard();
        await waitForConfigs();
        await completeOrganization();

        await userEvent.click(screen.getByRole('button', {name: 'I’ll do this later'}));
        await finishSetup();

        expect(completeSetup.mock.calls[0][0].site_url).toBeUndefined();
    });

    test('returns to the step with an error when the server rejects the URL', async () => {
        completeSetup.mockRejectedValue(new ClientError('', {
            message: 'invalid',
            server_error_id: 'api.error_invalid_site_url_provided_for_onboarding',
            status_code: 400,
            url: '',
        }));
        renderWizard();
        await waitForConfigs();
        await completeOrganization();
        await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
        await finishSetup();

        expect(await screen.findByText(siteUrlTitle)).toBeInTheDocument();
        expect(screen.getByText(/Enter only http:\/\/ or https:\/\/, a host name, and an optional port/)).toBeInTheDocument();
    });

    test('does not load the configs or show the step when the Site URL is already set', async () => {
        renderWizard(makeState({SiteURL: 'https://chat.example.com'}));
        await completeOrganization();

        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();
        expect(screen.queryByText(siteUrlTitle)).not.toBeInTheDocument();
        expect(getEnvironmentConfig).not.toHaveBeenCalled();
        expect(getAdminConfig).not.toHaveBeenCalled();
    });

    test('does not load the configs or show the step in the cloud', async () => {
        renderWizard(makeState({}, true));

        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();
        expect(screen.queryByText(siteUrlTitle)).not.toBeInTheDocument();
        expect(getEnvironmentConfig).not.toHaveBeenCalled();
        expect(getAdminConfig).not.toHaveBeenCalled();
    });

    test.each([
        ['an environment variable sets the Site URL', {data: {ServiceSettings: {SiteURL: true}}}, undefined],
        ['the admin is restricted', {data: {}}, {data: {ExperimentalSettings: {RestrictSystemAdmin: true}}}],
        ['the environment config fails to load', {error: new Error('failed')}, undefined],
        ['the admin config fails to load', {data: {}}, {error: new Error('failed')}],
    ])('hides the step when %s', async (_, envConfig, adminConfig) => {
        mockConfigs(envConfig, adminConfig);
        renderWizard();
        await waitForConfigs();
        await completeOrganization();

        expect(screen.queryByText(siteUrlTitle)).not.toBeInTheDocument();
        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();

        await finishSetup();
        expect(completeSetup.mock.calls[0][0].site_url).toBeUndefined();
    });

    test('does not add the step once the admin has left the Organization step', async () => {
        let resolveEnvConfig: (result: ConfigResult) => void = () => {};
        mockConfigs(new Promise((resolve) => {
            resolveEnvConfig = resolve;
        }));
        renderWizard();
        await completeOrganization();
        expect(await screen.findByText(inviteTitle)).toBeInTheDocument();

        await act(async () => resolveEnvConfig({data: {}}));

        expect(screen.queryByText(siteUrlTitle)).not.toBeInTheDocument();
        expect(screen.getByText(inviteTitle)).toBeInTheDocument();
    });
});
