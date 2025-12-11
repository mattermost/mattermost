// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

import DeleteConfirmationModal from './delete_confirmation';

describe('DeleteConfirmationModal', () => {
    const onExited = vi.fn();
    const onConfirm = vi.fn();
    const filterToDelete = {
        cidr_block: '192.168.0.0/16',
        description: 'Test IP Filter',
        enabled: true,
        owner_id: '',
    };

    const baseProps = {
        onExited,
        onConfirm,
        filterToDelete,
    };

    test('renders the modal with the correct title', () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
            />,
        );

        expect(getByText('Delete IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct filter name in description', () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
            />,
        );
        expect(getByText('Test IP Filter')).toBeInTheDocument();
    });

    test('calls the onClose function when the Cancel button is clicked', () => {
        const onExitedLocal = vi.fn();
        const onConfirmLocal = vi.fn();
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
                onExited={onExitedLocal}
                onConfirm={onConfirmLocal}
            />,
        );

        fireEvent.click(getByText('Cancel'));

        expect(onExitedLocal).toHaveBeenCalled();
        expect(onConfirmLocal).not.toHaveBeenCalled();
    });

    test('calls the onConfirm function with the correct filter when the Delete filter button is clicked', async () => {
        const onConfirmLocal = vi.fn();
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
                onConfirm={onConfirmLocal}
            />,
        );

        fireEvent.click(getByText('Delete filter'));

        await waitFor(() => {
            expect(onConfirmLocal).toHaveBeenCalledWith(filterToDelete);
        });
    });
});
