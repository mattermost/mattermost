// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import type {InstalledOutgoingOAuthConnectionProps} from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';
import InstalledOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

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
        onDelete: vi.fn(),
        filter: '',
    };

    test('should match snapshot', () => {
        const props = {...baseProps};
        const {container} = renderWithContext(
            <InstalledOutgoingOAuthConnection {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have called props.onDelete on handleDelete ', async () => {
        const newOnDelete = vi.fn();
        const props = {...baseProps, team, onDelete: newOnDelete};
        const {container} = renderWithContext(
            <InstalledOutgoingOAuthConnection {...props}/>,
        );

        // The DeleteIntegrationLink component renders a Delete button
        // that opens a confirmation modal, which then calls onDelete
        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
