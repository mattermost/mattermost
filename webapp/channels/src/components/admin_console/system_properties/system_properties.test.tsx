// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import type {PropertyField, UserPropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import BoardProperties from './board_properties';
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

    const baseField: UserPropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text' as const,
        group_id: 'custom_profile_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set' as const,
            value_type: '',
        },
    };

    const field0: UserPropertyField = {...baseField, id: 'test-id-0', name: 'test attribute 0'};
    const field1: UserPropertyField = {...baseField, id: 'test-id-1', name: 'test attribute 1'};
    const field2: UserPropertyField = {...baseField, id: 'test-id-2', name: 'test attribute 2'};
    const field3: UserPropertyField = {...baseField, id: 'test-id-3', name: 'test attribute 3'};

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

            expect(screen.getByRole('heading', {name: 'Configure user attributes'})).toBeInTheDocument();

            expect(await screen.findByDisplayValue('test attribute 0')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('test attribute 1')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('test attribute 2')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('test attribute 3')).toBeInTheDocument();
        });
    });

    describe('BoardProperties', () => {
        const getBoardFields = jest.spyOn(Client4, 'getBoardAttributeFields');

        const baseBoardField: PropertyField = {
            id: 'board-test-id',
            name: 'Board Test Field',
            type: 'text',
            group_id: 'board_attributes',
            create_at: 1736541716295,
            delete_at: 0,
            update_at: 0,
            created_by: '',
            updated_by: '',
            attrs: {
                sort_order: 0,
            },
        };

        const boardField0: PropertyField = {...baseBoardField, id: 'board-test-id-0', name: 'board attribute 0'};
        const boardField1: PropertyField = {...baseBoardField, id: 'board-test-id-1', name: 'board attribute 1'};
        const boardField2: PropertyField = {...baseBoardField, id: 'board-test-id-2', name: 'board attribute 2'};

        getBoardFields.mockResolvedValue([boardField0, boardField1, boardField2]);

        it('loads board properties', async () => {
            renderWithContext(<BoardProperties/>, getBaseState());

            await waitFor(() => {
                expect(screen.queryByText('Loading')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.queryByText('Loading')).not.toBeInTheDocument();
            });

            expect(screen.getByRole('heading', {name: 'Configure board attributes'})).toBeInTheDocument();

            expect(await screen.findByDisplayValue('board attribute 0')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('board attribute 1')).toBeInTheDocument();
            expect(await screen.findByDisplayValue('board attribute 2')).toBeInTheDocument();
        });
    });
});
