// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SecureConnectionDeleteModal from './secure_connection_delete_modal';

describe('SecureConnectionDeleteModal', () => {
    const baseProps = {
        displayName: 'Acme',
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the title and the displayName in the message', () => {
        renderWithContext(<SecureConnectionDeleteModal {...baseProps}/>);

        expect(screen.getByText('Delete secure connection')).toBeInTheDocument();
        expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    it('calls onConfirm when the confirm button is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<SecureConnectionDeleteModal {...baseProps}/>);

        await user.click(screen.getByRole('button', {name: 'Yes, delete'}));

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when the cancel button is clicked', async () => {
        const user = userEvent.setup();
        renderWithContext(<SecureConnectionDeleteModal {...baseProps}/>);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    it('does not throw when onCancel is omitted', async () => {
        const user = userEvent.setup();
        const props = {...baseProps, onCancel: undefined};

        renderWithContext(<SecureConnectionDeleteModal {...props}/>);

        await user.click(screen.getByRole('button', {name: 'Cancel'}));
    });
});
