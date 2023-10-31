// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import DeleteConfirmationModal from './delete_confirmation';

describe('DeleteConfirmationModal', () => {
    const onExited = jest.fn();
    const onConfirm = jest.fn();
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
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(getByText('Cancel'));

        expect(onExited).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('calls the onConfirm function with the correct filter when the Delete filter button is clicked', async () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(getByText('Delete filter'));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith(filterToDelete);
        });
    });
});
