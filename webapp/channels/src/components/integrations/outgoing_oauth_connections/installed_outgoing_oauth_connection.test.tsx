// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import DeleteIntegrationLink from 'components/integrations/delete_integration_link';
import type {InstalledOutgoingOAuthConnectionProps} from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';
import InstalledOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';

describe('components/integrations/InstalledOutgoingOAuthConnection', () => {
    const team = {name: 'team_name'};
    const outgoingOAuthConnection: OutgoingOAuthConnection = {
        id: 'someid',
        create_at: 1501365458934,
        creator_id: 'someuserid',
        update_at: 1501365458934,
        audiences: ['https://myaudience.com'],
        client_id: 'someid',
        client_secret: '',
        grant_type: 'client_credentials',
        name: 'My OAuth Connection',
        oauth_token_url: 'https://tokenurl.com',
    };

    const baseProps: InstalledOutgoingOAuthConnectionProps = {
        team,
        outgoingOAuthConnection,
        creatorName: 'somename',
        onDelete: jest.fn(),
        filter: '',
    };

    test('should match snapshot', () => {
        const props = {...baseProps};
        const wrapper = shallow(
            <InstalledOutgoingOAuthConnection {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should have called props.onDelete on handleDelete ', () => {
        const newOnDelete = jest.fn();
        const props = {...baseProps, team, onDelete: newOnDelete};
        const wrapper = shallow(
            <InstalledOutgoingOAuthConnection {...props}/>,
        );

        expect(wrapper.find(DeleteIntegrationLink).exists()).toBe(true);
        wrapper.find(DeleteIntegrationLink).props().onDelete();
        expect(newOnDelete).toBeCalled();
        expect(newOnDelete).toHaveBeenCalledWith(outgoingOAuthConnection);
    });
});
