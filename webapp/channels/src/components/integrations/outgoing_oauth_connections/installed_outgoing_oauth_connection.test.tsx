// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';

import type {InstalledOutgoingOAuthConnectionProps} from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';
import InstalledOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/installed_outgoing_oauth_connection';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('components/integrations/delete_integration_link', () => {
    return function MockDeleteIntegrationLink(props: {onDelete: () => void}) {
        return (
            <button
                data-testid='delete-integration-link'
                onClick={props.onDelete}
            >
                {'Delete'}
            </button>
        );
    };
});

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
        const {container} = renderWithContext(
            <InstalledOutgoingOAuthConnection {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should have called props.onDelete on handleDelete ', async () => {
        const newOnDelete = jest.fn();
        const props = {...baseProps, team, onDelete: newOnDelete};
        renderWithContext(
            <InstalledOutgoingOAuthConnection {...props}/>,
        );

        const deleteButton = screen.getByTestId('delete-integration-link');
        expect(deleteButton).toBeInTheDocument();

        await userEvent.click(deleteButton);
        expect(newOnDelete).toHaveBeenCalled();
        expect(newOnDelete).toHaveBeenCalledWith(outgoingOAuthConnection);
    });
});
