// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Permissions} from 'mattermost-redux/constants';

import AddOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/add_outgoing_oauth_connection';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/integrations/AddOutgoingOAuthConnection', () => {
    const team = TestHelper.getTeamMock({
        id: 'dbcxd9wpzpbpfp8pad78xj12pr',
        name: 'test',
    });

    test('should match snapshot', () => {
        const baseProps: React.ComponentProps<typeof AddOutgoingOAuthConnection> = {
            team,
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
            },
        };

        const props = {...baseProps};
        const {container} = renderWithContext(
            <AddOutgoingOAuthConnection {...props}/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });
});
