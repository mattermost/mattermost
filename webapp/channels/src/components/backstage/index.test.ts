// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {mapStateToProps} from './index';

describe('components/backstage mapStateToProps', () => {
    function getState(systemPermissions: string[], config: Record<string, string> = {}) {
        const state: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config,
                },
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: TestHelper.getUserMock({id: 'user_id', roles: 'system_user'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                    myMembers: {
                        team_id: TestHelper.getTeamMembershipMock({team_id: 'team_id', user_id: 'user_id', roles: 'team_user'}),
                    },
                },
                roles: {
                    roles: {
                        system_user: TestHelper.getRoleMock({name: 'system_user', permissions: systemPermissions}),
                        team_user: TestHelper.getRoleMock({name: 'team_user', permissions: []}),
                    },
                },
            },
        };

        return state as GlobalState;
    }

    test('should allow managing integrations when outgoing OAuth connections are enabled and that is the only permission', () => {
        const state = getState([Permissions.MANAGE_OUTGOING_OAUTH_CONNECTIONS], {EnableOutgoingOAuthConnections: 'true'});

        expect(mapStateToProps(state).canManageIntegrations).toBe(true);
    });

    test('should not allow managing integrations when outgoing OAuth connections are disabled and that is the only permission', () => {
        const state = getState([Permissions.MANAGE_OUTGOING_OAUTH_CONNECTIONS], {EnableOutgoingOAuthConnections: 'false'});

        expect(mapStateToProps(state).canManageIntegrations).toBe(false);
    });

    test('should not allow managing integrations when outgoing OAuth connections are enabled but the user lacks the permission', () => {
        const state = getState([], {EnableOutgoingOAuthConnections: 'true'});

        expect(mapStateToProps(state).canManageIntegrations).toBe(false);
    });
});
