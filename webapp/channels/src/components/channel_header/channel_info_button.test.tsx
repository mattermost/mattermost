// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {RHSStates} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ChannelInfoButton from './channel_info_button';

describe('components/channel_header/ChannelInfoButton', () => {
    const channel = TestHelper.getChannelMock({id: 'channel_id'});

    test('should not be active when channel info RHS is closed', () => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {
                views: {
                    rhs: {
                        rhsState: null,
                        isSidebarOpen: false,
                    },
                },
            },
        );

        expect(screen.getByLabelText('View Info')).not.toHaveAttribute('data-active');
    });

    test('should pass active when channel info RHS is open', () => {
        renderWithContext(
            <ChannelInfoButton channel={channel}/>,
            {
                views: {
                    rhs: {
                        rhsState: RHSStates.CHANNEL_INFO,
                        isSidebarOpen: true,
                    },
                },
            },
        );

        expect(screen.getByLabelText('Close Info')).toHaveAttribute('data-active', 'true');
    });

    describe('missing required attribute values', () => {
        const requiredField: PropertyField = {
            id: 'program',
            group_id: 'group1',
            name: 'program',
            type: 'select',
            target_id: '',
            target_type: 'system',
            object_type: 'channel',
            permission_values: 'admin',
            attrs: {required: true, display_name: 'Program', options: [{id: 'opt', name: 'One'}]},
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            created_by: '',
            updated_by: '',
        };

        function stateWith({admin}: {admin: boolean}): DeepPartial<GlobalState> {
            return {
                entities: {
                    general: {
                        config: {FeatureFlagChannelAttributes: 'true', FeatureFlagChannelAttributesRequired: 'true'},
                        license: {IsLicensed: 'true', SkuShortName: 'advanced'},
                    },
                    channels: {channels: {channel_id: {id: 'channel_id', team_id: 'team1', type: 'O', delete_at: 0}}},
                    users: {
                        currentUserId: 'user1',
                        profiles: {user1: {id: 'user1', roles: admin ? 'system_admin' : 'system_user'}},
                    },
                    properties: {
                        groups: {byId: {group1: {id: 'group1', name: 'access_control'}}, byName: {access_control: {id: 'group1', name: 'access_control'}}},
                        fields: {byId: {program: requiredField}, byObjectType: {channel: {group1: {program: requiredField}}}},
                        values: {byTargetId: {}, byFieldId: {}},
                        loadedValueTargets: {channel_id: true},
                    },
                },
            } as DeepPartial<GlobalState>;
        }

        test('shows the icon in red and extends the label for someone who can fix them', () => {
            const {container} = renderWithContext(<ChannelInfoButton channel={channel}/>, stateWith({admin: true}));

            expect(container.querySelector('.channelInfoButton__icon--missingValues')).toBeInTheDocument();
            expect(screen.getByLabelText('View Info, channel attribute values are missing')).toBeInTheDocument();
        });

        test('shows neither for someone who cannot fix them', () => {
            const {container} = renderWithContext(<ChannelInfoButton channel={channel}/>, stateWith({admin: false}));

            expect(container.querySelector('.channelInfoButton__icon--missingValues')).not.toBeInTheDocument();
            expect(screen.getByLabelText('View Info')).toBeInTheDocument();
        });
    });
});
