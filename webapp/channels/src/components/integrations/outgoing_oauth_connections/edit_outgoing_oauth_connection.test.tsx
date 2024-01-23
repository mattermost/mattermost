// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import EditOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/edit_outgoing_oauth_connection';

describe('components/integrations/EditOutgoingOAuthConnection', () => {
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
    const team: Team = {
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    } as Team;

    const baseProps: React.ComponentProps<typeof EditOutgoingOAuthConnection> = {
        team,
        location: {
            search: '?id=facxd9wpzpbpfp8pad78xj75pr',
        } as any,
    };

    test('should match snapshot, loading', () => {
        const props = {...baseProps, oauthApp: connection};
        const wrapper = shallow<typeof EditOutgoingOAuthConnection>(
            <EditOutgoingOAuthConnection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot', () => {
        const props = {...baseProps, oauthApp: connection};
        const wrapper = shallow<typeof EditOutgoingOAuthConnection>(
            <EditOutgoingOAuthConnection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when EnableOAuthServiceProvider is false', () => {
        const props = {...baseProps, oauthApp: connection, enableOAuthServiceProvider: false};
        const wrapper = shallow<typeof EditOutgoingOAuthConnection>(
            <EditOutgoingOAuthConnection {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
