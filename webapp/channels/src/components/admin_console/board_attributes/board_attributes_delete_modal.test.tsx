// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import RemoveBoardAttributeFieldModal from './board_attributes_delete_modal';

describe('RemoveBoardAttributeFieldModal', () => {
    const renderModal = (overrides: Partial<React.ComponentProps<typeof RemoveBoardAttributeFieldModal>> = {}) => {
        const props = {
            onConfirm: jest.fn(),
            onCancel: jest.fn(),
            onExited: jest.fn(),
            ...overrides,
        };
        renderWithContext(<RemoveBoardAttributeFieldModal {...props}/>);
        return props;
    };

    it('renders the title, confirmation copy, and destructive confirm button', () => {
        renderModal();

        expect(screen.getByRole('heading', {name: /delete board attribute/i})).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete this board attribute/i)).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /^delete$/i})).toBeInTheDocument();
    });

    it('invokes onConfirm when the Delete button is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /^delete$/i}));

        expect(props.onConfirm).toHaveBeenCalledTimes(1);
        expect(props.onCancel).not.toHaveBeenCalled();
    });

    it('invokes onCancel when the Cancel button is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(props.onCancel).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });
});
