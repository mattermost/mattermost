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

    describe('orphaned attribute', () => {
        it('names the uninstalled plugin the attribute was left behind by', () => {
            renderModal({isOrphaned: true, sourcePluginId: 'com.acme.plugin'});

            expect(screen.getByText(/was created by the plugin "com\.acme\.plugin", which is no longer installed/i)).toBeInTheDocument();

            // * The standard warning is kept alongside it rather than replaced — an
            // orphaned attribute is just as permanently deleted as any other
            expect(screen.getByText(/permanently remove its definition/i)).toBeInTheDocument();
        });

        it('falls back to "unknown" when the source plugin id is missing', () => {
            renderModal({isOrphaned: true});

            expect(screen.getByText(/was created by the plugin "unknown"/i)).toBeInTheDocument();
        });

        it('says nothing about plugins for an ordinary attribute', () => {
            renderModal();

            expect(screen.queryByText(/no longer installed/i)).not.toBeInTheDocument();
        });
    });
});
