// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import DeleteConfirmationModal from './delete_confirmation';

describe('DeleteConfirmationModal', () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    const filterToDelete = {
        CIDRBlock: '192.168.0.0/16',
        Description: 'Test IP Filter',
        Enabled: true,
        OwnerID: '',
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('renders the modal with the correct title', () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                onClose={onClose}
                onConfirm={onConfirm}
                filterToDelete={filterToDelete}
            />,
        );

        expect(getByText('Delete IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct filter name in description', () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                onClose={onClose}
                onConfirm={onConfirm}
                filterToDelete={filterToDelete}
            />,
        );
        expect(getByText('Test IP Filter')).toBeInTheDocument();
    });

    test('calls the onClose function when the Cancel button is clicked', () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                onClose={onClose}
                onConfirm={onConfirm}
                filterToDelete={filterToDelete}
            />,
        );

        fireEvent.click(getByText('Cancel'));

        expect(onClose).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    test('calls the onConfirm function with the correct filter when the Delete filter button is clicked', async () => {
        const {getByText} = render(
            <DeleteConfirmationModal
                onClose={onClose}
                onConfirm={onConfirm}
                filterToDelete={filterToDelete}
            />,
        );

        fireEvent.click(getByText('Delete filter'));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith(filterToDelete);
        });
    });
});
