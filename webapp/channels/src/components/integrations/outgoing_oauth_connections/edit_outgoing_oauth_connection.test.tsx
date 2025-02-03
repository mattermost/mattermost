// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import {Permissions} from 'mattermost-redux/constants';

import EditOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/edit_outgoing_oauth_connection';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/EditOutgoingOAuthConnection', () => {
    const team = TestHelper.getTeamMock({
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    });

    const outgoingOAuthConnections: Record<string, OutgoingOAuthConnection> = {
        facxd9wpzpbpfp8pad78xj75pr: {
            id: 'facxd9wpzpbpfp8pad78xj75pr',
            name: 'firstConnection',
            client_secret: '',
            create_at: 1501365458934,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            update_at: 1501365458934,
            audiences: ['https://mysite.com/api', 'https://myothersite.com/api/v2'],
            client_id: 'client1',
            grant_type: 'client_credentials',
            oauth_token_url: 'https://oauthtoken1.com/oauth/token',
        },
        fzcxd9wpzpbpfp8pad78xj75pr: {
            id: 'fzcxd9wpzpbpfp8pad78xj75pr',
            name: 'secondConnection',
            client_secret: '',
            create_at: 1501365458935,
            creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
            update_at: 1501365458935,
            audiences: ['https://myaudience.com/api'],
            client_id: 'client2',
            grant_type: 'client_credentials',
            oauth_token_url: 'https://oauthtoken2.com/oauth/token',
        },
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

    const connection: OutgoingOAuthConnection = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testApp',
        client_secret: '88cxd9wpzpbpfp8pad78xj75pr',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        update_at: 1501365458934,
        audiences: ['https://test.com/callback', 'https://test.com/callback2'],
        client_id: 'someclientid',
        grant_type: 'client_credentials',
        oauth_token_url: 'https://mytoken.url',
    };

    const baseProps: React.ComponentProps<typeof EditOutgoingOAuthConnection> = {
        team,
        location: {
            search: '?id=facxd9wpzpbpfp8pad78xj75pr',
        } as any,
    };

    test('should match snapshot, loading', () => {
        const props = {...baseProps, oauthApp: connection};
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <EditOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot', () => {
        const props = {...baseProps, oauthApp: connection};
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <EditOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when EnableOAuthServiceProvider is false', () => {
        const props = {...baseProps, oauthApp: connection, enableOAuthServiceProvider: false};
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <EditOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
