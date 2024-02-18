// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';
import {BrowserRouter as Router} from 'react-router-dom';

import {Permissions} from 'mattermost-redux/constants';

import AddOutgoingOAuthConnection from 'components/integrations/outgoing_oauth_connections/add_outgoing_oauth_connection';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
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
        const store = mockStore(state);
        const wrapper = mountWithIntl(
            <Router>
                <Provider store={store}>
                    <AddOutgoingOAuthConnection {...props}/>
                </Provider>
            </Router>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
