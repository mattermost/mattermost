// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import {Permissions} from 'mattermost-redux/constants';

import AbstractOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/abstract_outgoing_oauth_connection';

import {renderWithContext, screen, userEvent, act} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AbstractOutgoingOAuthConnection', () => {
    const header = {id: 'Header', defaultMessage: 'Header'};
    const footer = {id: 'Footer', defaultMessage: 'Footer'};
    const loading = {id: 'Loading', defaultMessage: 'Loading'};
    const initialConnection: OutgoingOAuthConnection = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testConnection',
        client_secret: '',
        client_id: 'clientid',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        update_at: 1501365458934,
        grant_type: 'client_credentials',
        oauth_token_url: 'https://token.com',
        audiences: ['https://aud.com'],
    };

    const outgoingOAuthConnections: Record<string, OutgoingOAuthConnection> = {
        facxd9wpzpbpfp8pad78xj75pr: initialConnection,
    };

    const state = {
        entities: {
            general: {
                config: {
                    EnableOutgoingOAuthConnections: 'true',
                },
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_role'},
                },
            },
            roles: {
                roles: {
                    system_role: {id: 'system_role', permissions: [Permissions.MANAGE_OUTGOING_OAUTH_CONNECTIONS]},
                },
            },
            integrations: {
                outgoingOAuthConnections,
            },
        },
    };

    const team = TestHelper.getTeamMock({name: 'test', id: initialConnection.id});

    const baseProps: React.ComponentProps<typeof AbstractOutgoingOAuthConnection> = {
        team,
        header,
        footer,
        loading,
        renderExtra: <div>{'renderExtra'}</div>,
        serverError: '',
        initialConnection,
        submitAction: jest.fn(),
    };

    test('should match snapshot', () => {
        const props = {...baseProps};
        const {container} = renderWithContext(
            <Router>
                <AbstractOutgoingOAuthConnection {...props}/>
            </Router>,
            state,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', async () => {
        const submitAction = jest.fn().mockResolvedValue({data: true});

        const newServerError = 'serverError';
        const props = {...baseProps, serverError: newServerError, submitAction};
        const {container} = renderWithContext(
            <Router>
                <AbstractOutgoingOAuthConnection {...props}/>
            </Router>,
            state,
        );

        const audienceUrlsInput = screen.getByDisplayValue('https://aud.com');
        await userEvent.clear(audienceUrlsInput);

        const submitButton = container.querySelector('button.btn-primary') as HTMLButtonElement;
        await act(async () => {
            submitButton?.click();
        });

        expect(submitAction).not.toHaveBeenCalled();
        expect(container).toMatchSnapshot();
    });

    test('should call action function', async () => {
        const submitAction = jest.fn().mockResolvedValue({data: true});

        const props = {...baseProps, submitAction};
        const {container} = renderWithContext(
            <Router>
                <AbstractOutgoingOAuthConnection {...props}/>
            </Router>,
            state,
        );

        await act(async () => {
            const nameInput = container.querySelector('#name') as HTMLInputElement;
            if (nameInput) {
                nameInput.value = 'name';
                nameInput.dispatchEvent(new Event('change', {bubbles: true}));
            }

            const submitButton = container.querySelector('button.btn-primary') as HTMLButtonElement;
            submitButton?.click();

            expect(submitAction).toHaveBeenCalled();
        });
    });
});
