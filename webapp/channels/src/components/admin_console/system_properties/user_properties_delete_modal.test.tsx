// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {renderWithContext, renderHookWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import RemoveUserPropertyFieldModal, {useUserPropertyFieldDelete} from './user_properties_delete_modal';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

describe('RemoveUserPropertyFieldModal', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const onExited = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders with the correct field name', () => {
        renderWithContext(
            <RemoveUserPropertyFieldModal
                name='Test Field'
                onConfirm={onConfirm}
                onCancel={onCancel}
                onExited={onExited}
            />,
        );

        expect(screen.getByText('Delete Test Field property')).toBeInTheDocument();
        expect(screen.getByText('Deleting this property will remove all user-defined values associated with it.')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', () => {
        renderWithContext(
            <RemoveUserPropertyFieldModal
                name='Test Field'
                onConfirm={onConfirm}
                onCancel={onCancel}
                onExited={onExited}
            />,
        );

        fireEvent.click(screen.getByText('Delete'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is clicked', () => {
        renderWithContext(
            <RemoveUserPropertyFieldModal
                name='Test Field'
                onConfirm={onConfirm}
                onCancel={onCancel}
                onExited={onExited}
            />,
        );

        fireEvent.click(screen.getByText('Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('useUserPropertyFieldDelete', () => {
    const baseField: UserPropertyField = {
        id: 'test-id',
        name: 'Test Field',
        type: 'text',
        group_id: 'custom_profile_attributes',
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    };

    it('calls openModal with correct params when promptDelete is called', () => {
        const {result} = renderHookWithContext(() => useUserPropertyFieldDelete());

        result.current.promptDelete(baseField);

        expect(openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.USER_PROPERTY_FIELD_DELETE,
            dialogType: RemoveUserPropertyFieldModal,
            dialogProps: {
                name: baseField.name,
                onConfirm: expect.any(Function),
            },
        });
    });

    it('returns a promise that resolves when onConfirm is called', async () => {
        const {result} = renderHookWithContext(() => useUserPropertyFieldDelete());

        // Create a mock implementation that immediately calls the onConfirm callback
        (openModal as jest.Mock).mockImplementationOnce(({dialogProps}) => {
            dialogProps.onConfirm();
            return {type: 'MOCK_OPEN_MODAL'};
        });

        const promise = result.current.promptDelete(baseField);

        await expect(promise).resolves.toBe(true);
    });
});
