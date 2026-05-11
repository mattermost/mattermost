// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import WikiUnlinkModal from './wiki_unlink_modal';

const mockCloseModal = jest.fn();

jest.mock('actions/views/modals', () => ({
    closeModal: (...args: any[]) => {
        mockCloseModal(...args);
        return {type: 'MOCK_CLOSE_MODAL'};
    },
}));

describe('WikiUnlinkModal', () => {
    const baseProps = {
        wikiTitle: 'Test Wiki',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render confirmation dialog with wiki title', () => {
        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        expect(screen.getByText('Remove wiki from channel')).toBeInTheDocument();
        expect(screen.getByText('Test Wiki')).toBeInTheDocument();
        expect(screen.getByText('Remove')).toBeInTheDocument();
    });

    test('should render message with wiki title in bold', () => {
        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        const strongElement = screen.getByText('Test Wiki');
        expect(strongElement.tagName).toBe('STRONG');
    });

    test('should handle unlink action', async () => {
        baseProps.onConfirm.mockResolvedValue(undefined);

        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        const confirmButton = screen.getByText('Remove');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(mockCloseModal).toHaveBeenCalled();
        });
    });

    test('should show error when unlink fails', async () => {
        baseProps.onConfirm.mockRejectedValue(new Error('unlink failed'));

        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        const confirmButton = screen.getByText('Remove');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Failed to remove wiki. Please try again.');
        });
    });

    test('should handle cancel', async () => {
        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        await userEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    test('should disable confirm button while unlinking', async () => {
        let resolveConfirm: () => void;
        baseProps.onConfirm.mockImplementation(() => new Promise<void>((resolve) => {
            resolveConfirm = resolve;
        }));

        renderWithContext(<WikiUnlinkModal {...baseProps}/>);

        const confirmButton = screen.getByText('Remove');
        await userEvent.click(confirmButton);

        await waitFor(() => {
            expect(confirmButton).toBeDisabled();
        });

        resolveConfirm!();
    });
});
