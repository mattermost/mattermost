// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import {Permissions} from 'mattermost-redux/constants';

import OAuthConnectionAudienceInput from 'components/integrations/outgoing_oauth_connections/oauth_connection_audience_input';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

describe('components/integrations/outgoing_oauth_connections/OAuthConnectionAudienceInput', () => {
    const connection: OutgoingOAuthConnection = {
        id: 'facxd9wpzpbpfp8pad78xj75pr',
        name: 'testConnection',
        client_secret: '',
        client_id: 'clientid',
        create_at: 1501365458934,
        creator_id: '88oybd1dwfdoxpkpw1h5kpbyco',
        update_at: 1501365458934,
        grant_type: 'client_credentials',
        oauth_token_url: 'https://token.com',
        audiences: ['https://aud.com/api'],
    };

    const baseProps: React.ComponentProps<typeof OAuthConnectionAudienceInput> = {
        value: '',
        onChange: jest.fn(),
        placeholder: '',
    };

    const stateFromOAuthConnections = (connections: Record<string, OutgoingOAuthConnection>) => {
        return {
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
                    outgoingOAuthConnections: connections,
                },
            },
        };
    };

    test('should match snapshot with no existing connections', () => {
        const props = {...baseProps};
        const state = stateFromOAuthConnections({});
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <OAuthConnectionAudienceInput {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with existing connections', () => {
        const props = {...baseProps};
        const state = stateFromOAuthConnections({[connection.id]: connection});
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <OAuthConnectionAudienceInput {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when typed in value matches a configured audience', () => {
        const props = {...baseProps, value: 'https://aud.com/api'};
        const state = stateFromOAuthConnections({[connection.id]: connection});
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <OAuthConnectionAudienceInput {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when typed in value does not have an exact match', () => {
        const props = {...baseProps, value: 'https://aud.com/api/no_match'};
        const state = stateFromOAuthConnections({[connection.id]: connection});
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <OAuthConnectionAudienceInput {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when an audience url with a wildcard is configured, and typed in value starts with configured audience url', () => {
        const props = {...baseProps, value: 'https://aud.com/api/it_matches'};
        const state = stateFromOAuthConnections({[connection.id]: {...connection, audiences: ['https://aud.com/api/*']}});
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <OAuthConnectionAudienceInput {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
