// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SystemProperties from './system_properties';

function getBaseState(): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();
    const otherUser = TestHelper.getUserMock();

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                    [otherUser.id]: otherUser,
                },
            },
            general: {

            },
        },
    };
}

describe('SystemProperties', () => {
    const getFields = jest.spyOn(Client4, 'getCustomProfileAttributeFields');

    const baseField = {type: 'text' as const, group_id: 'custom_profile_attributes' as const, create_at: 1736541716295, delete_at: 0, update_at: 0};
    const field0: UserPropertyField = {id: 'f0', name: 'test attribute 0', ...baseField};
    const field1: UserPropertyField = {id: 'f1', name: 'test attribute 1', ...baseField};
    const field2: UserPropertyField = {id: 'f2', name: 'test attribute 2', ...baseField};
    const field3: UserPropertyField = {id: 'f3', name: 'test attribute 3', ...baseField};

    getFields.mockResolvedValue([field0, field1, field2, field3]);

    describe('UserProperties', () => {
        it('loads custom user properties', async () => {
            renderWithContext(<SystemProperties disabled={false}/>, getBaseState());

            await waitFor(() => {
                expect(screen.queryByText('Loading')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.queryByText('Loading')).not.toBeInTheDocument();
            });

            expect(screen.getByRole('heading', {name: 'User Properties'})).toBeInTheDocument();

            expect(screen.queryByDisplayValue('test attribute 0')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('test attribute 1')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('test attribute 2')).toBeInTheDocument();
            expect(screen.queryByDisplayValue('test attribute 3')).toBeInTheDocument();
        });
    });
});
