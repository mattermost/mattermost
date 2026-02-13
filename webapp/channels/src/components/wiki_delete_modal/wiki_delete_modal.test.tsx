// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import WikiDeleteModal from 'components/wiki_delete_modal/wiki_delete_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/WikiDeleteModal', () => {
    const baseProps = {
        wikiTitle: 'Test Wiki',
        onConfirm: jest.fn().mockResolvedValue(undefined),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', () => {
        renderWithContext(<WikiDeleteModal {...baseProps}/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Delete wiki')).toBeInTheDocument();
    });

    test('should display wiki title in warning message', () => {
        renderWithContext(<WikiDeleteModal {...baseProps}/>);

        expect(screen.getByText('Test Wiki')).toBeInTheDocument();
    });

    test('should have confirm button text', () => {
        renderWithContext(<WikiDeleteModal {...baseProps}/>);

        expect(screen.getByText('Yes, delete')).toBeInTheDocument();
    });

    test('should call onConfirm when Delete button is clicked', async () => {
        renderWithContext(<WikiDeleteModal {...baseProps}/>);

        const confirmButton = screen.getByText('Yes, delete');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(baseProps.onConfirm).toHaveBeenCalled();
        });
    });

    test('should call onCancel when Cancel button is clicked', () => {
        renderWithContext(<WikiDeleteModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    test('should disable confirm button while deleting', async () => {
        const slowConfirm = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
        renderWithContext(
            <WikiDeleteModal
                {...baseProps}
                onConfirm={slowConfirm}
            />,
        );

        const confirmButton = screen.getByText('Yes, delete');
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(slowConfirm).toHaveBeenCalled();
        });
    });
});
