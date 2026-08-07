// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import GlobalAttributeDeleteModal from './global_attribute_delete_modal';

describe('GlobalAttributeDeleteModal', () => {
    const renderModal = (overrides: Partial<React.ComponentProps<typeof GlobalAttributeDeleteModal>> = {}) => {
        const props = {
            name: 'Department',
            onConfirm: jest.fn(),
            onExited: jest.fn(),
            ...overrides,
        };
        renderWithContext(<GlobalAttributeDeleteModal {...props}/>);
        return props;
    };

    it('names the attribute being deleted in the title, rather than a generic prompt', () => {
        renderModal({name: 'Department'});

        expect(screen.getByRole('heading', {name: /delete department attribute/i})).toBeInTheDocument();
        expect(screen.getByText(/permanently remove its definition/i)).toBeInTheDocument();
    });

    it('invokes onConfirm when the Delete button is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /^delete$/i}));

        expect(props.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not invoke onConfirm when the Cancel button is clicked', async () => {
        const props = renderModal();

        await userEvent.click(screen.getByRole('button', {name: /cancel/i}));

        expect(props.onConfirm).not.toHaveBeenCalled();
    });
});
