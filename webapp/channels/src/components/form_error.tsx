// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import {Permissions} from 'mattermost-redux/constants';

import AbstractOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/abstract_outgoing_oauth_connection';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
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
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <AbstractOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, displays client error', () => {
        const submitAction = jest.fn().mockResolvedValue({data: true});

        const newServerError = 'serverError';
        const props = {...baseProps, serverError: newServerError, submitAction};
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <AbstractOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        wrapper.find('#audienceUrls').simulate('change', {target: {value: ''}});
        wrapper.find('button.btn-primary').simulate('click', {preventDefault() {
            return jest.fn();
        }});

        expect(submitAction).not.toBeCalled();
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('Memo(FormError)').exists()).toBe(true);
    });

    test('should call action function', async () => {
        const submitAction = jest.fn().mockResolvedValue({data: true});

        const props = {...baseProps, submitAction};
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <AbstractOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        await act(async () => {
            wrapper.find('#name').simulate('change', {target: {value: 'name'}});
            wrapper.find('button.btn-primary').simulate('click', {preventDefault() {
                return jest.fn();
            }});

            expect(submitAction).toBeCalled();
        });
    });
});
